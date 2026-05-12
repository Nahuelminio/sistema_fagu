import { Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'

const botellaSchema = z.object({
  productId: z.number().int().positive(),
  capacidad: z.number().positive(),
  alertaOz:  z.number().positive().optional(),
})

const botellaInclude = {
  product: { select: { id: true, name: true, unit: true } },
}

export async function getBotellas(_req: AuthRequest, res: Response): Promise<void> {
  const botellas = await prisma.botellaActiva.findMany({
    include: botellaInclude,
    orderBy: { product: { name: 'asc' } },
  })
  res.json(botellas)
}

export async function abrirBotella(req: AuthRequest, res: Response): Promise<void> {
  const parsed = botellaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }

  const { productId, capacidad, alertaOz = 3 } = parsed.data

  // Verificar que haya stock de botellas cerradas
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) { res.status(404).json({ error: 'Producto no encontrado' }); return }
  if (Number(product.currentStock) < 1) {
    res.status(400).json({ error: `No hay botellas cerradas de "${product.name}"` })
    return
  }

  const botella = await prisma.$transaction(async (tx) => {
    const b = await tx.botellaActiva.upsert({
      where:  { productId },
      update: { capacidad, restante: capacidad, alertaOz, abiertaEn: new Date() },
      create: { productId, capacidad, restante: capacidad, alertaOz },
      include: botellaInclude,
    })

    // Abrir botella = -1 botella cerrada del stock + crear movimiento
    await tx.stockMovement.create({
      data: {
        productId,
        userId: req.user!.userId,
        type: 'SALIDA',
        quantity: 1,
        notes: `Apertura de botella (${capacidad} oz)`,
      },
    })
    await tx.product.update({
      where: { id: productId },
      data: { currentStock: { decrement: 1 } },
    })

    return b
  })

  res.status(201).json(botella)
}

export async function cerrarBotella(req: AuthRequest, res: Response): Promise<void> {
  const productId = parseInt(req.params.productId)
  await prisma.botellaActiva.deleteMany({ where: { productId } })
  res.status(204).send()
}
