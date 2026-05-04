import { Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'

const ingredienteSchema = z.object({
  productId: z.number().int().positive(),
  cantidad: z.number().positive(),
})

const tragoSchema = z.object({
  name: z.string().min(1),
  salePrice: z.number().positive().optional(),
  active: z.boolean().optional(),
  ingredientes: z.array(ingredienteSchema).min(1, 'El trago debe tener al menos un ingrediente'),
})

const tragoInclude = {
  ingredientes: {
    include: {
      product: { select: { id: true, name: true, unit: true, currentStock: true } },
    },
  },
}

export async function getTragos(_req: AuthRequest, res: Response): Promise<void> {
  const tragos = await prisma.trago.findMany({
    include: tragoInclude,
    orderBy: { name: 'asc' },
  })
  res.json(tragos)
}

export async function createTrago(req: AuthRequest, res: Response): Promise<void> {
  const parsed = tragoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }

  const { name, salePrice, active = true, ingredientes } = parsed.data

  const trago = await prisma.trago.create({
    data: {
      name,
      salePrice,
      active,
      ingredientes: {
        create: ingredientes.map((i) => ({
          productId: i.productId,
          cantidad: i.cantidad,
        })),
      },
    },
    include: tragoInclude,
  })

  res.status(201).json(trago)
}

export async function updateTrago(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  const parsed = tragoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }

  const { name, salePrice, active, ingredientes } = parsed.data

  // Reemplazar todos los ingredientes en una transacción
  const trago = await prisma.$transaction(async (tx) => {
    await tx.tragoBotella.deleteMany({ where: { tragoId: id } })
    return tx.trago.update({
      where: { id },
      data: {
        name,
        salePrice,
        ...(active !== undefined && { active }),
        ingredientes: {
          create: ingredientes.map((i) => ({
            productId: i.productId,
            cantidad: i.cantidad,
          })),
        },
      },
      include: tragoInclude,
    })
  })

  res.json(trago)
}

export async function deleteTrago(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  await prisma.trago.delete({ where: { id } })
  res.status(204).send()
}
