import { Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'
import { broadcastCatalogUpdate } from '../services/sse.service'

const ingredienteSchema = z.object({
  productId: z.number().int().positive(),
  cantidad: z.number().positive(),
})

const tragoSchema = z.object({
  name: z.string().min(1),
  salePrice: z.number().positive().optional(),
  active: z.boolean().optional(),
  imageUrl: z.string().url().nullable().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  visibleInCatalog: z.boolean().optional(),
  ingredientes: z.array(ingredienteSchema).min(1, 'El trago debe tener al menos un ingrediente'),
})

const tragoInclude = {
  ingredientes: {
    include: {
      product: {
        select: {
          id: true, name: true, unit: true, currentStock: true, costPrice: true, bottleSize: true,
          botellaActiva: { select: { capacidad: true } },
        },
      },
    },
  },
}

// Por defecto Prisma incluye todos los scalars de Trago en findMany,
// así que imageUrl/description/visibleInCatalog ya vienen automáticamente.

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

  const { name, salePrice, active = true, imageUrl, description, visibleInCatalog, ingredientes } = parsed.data

  const trago = await prisma.trago.create({
    data: {
      name,
      salePrice,
      active,
      imageUrl: imageUrl || null,
      description: description || null,
      visibleInCatalog: visibleInCatalog ?? false,
      ingredientes: {
        create: ingredientes.map((i) => ({
          productId: i.productId,
          cantidad: i.cantidad,
        })),
      },
    },
    include: tragoInclude,
  })

  if (trago.visibleInCatalog) broadcastCatalogUpdate()
  res.status(201).json(trago)
}

export async function updateTrago(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  const parsed = tragoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }

  const { name, salePrice, active, imageUrl, description, visibleInCatalog, ingredientes } = parsed.data

  // Reemplazar todos los ingredientes en una transacción
  const trago = await prisma.$transaction(async (tx) => {
    await tx.tragoBotella.deleteMany({ where: { tragoId: id } })
    return tx.trago.update({
      where: { id },
      data: {
        name,
        salePrice,
        ...(active !== undefined && { active }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        ...(description !== undefined && { description: description || null }),
        ...(visibleInCatalog !== undefined && { visibleInCatalog }),
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

  if (trago.visibleInCatalog) broadcastCatalogUpdate()
  res.json(trago)
}

/** Toggle rápido de visibleInCatalog para tragos */
export async function toggleCatalogTrago(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return }

  const t = await prisma.trago.findUnique({ where: { id }, select: { visibleInCatalog: true } })
  if (!t) { res.status(404).json({ error: 'Trago no encontrado' }); return }

  const updated = await prisma.trago.update({
    where: { id },
    data:  { visibleInCatalog: !t.visibleInCatalog },
    include: tragoInclude,
  })
  broadcastCatalogUpdate()
  res.json(updated)
}

export async function deleteTrago(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return }

  // Si el trago ya fue vendido, hacer soft-delete (marcarlo inactivo)
  // para preservar el historial de ventas. Sino, eliminarlo del todo.
  const sold = await prisma.saleItem.count({ where: { tragoId: id } })
  if (sold > 0) {
    await prisma.trago.update({ where: { id }, data: { active: false } })
    broadcastCatalogUpdate()
    res.json({ ok: true, softDeleted: true })
    return
  }

  try {
    await prisma.trago.delete({ where: { id } })
    broadcastCatalogUpdate()
    res.status(204).send()
  } catch (e: any) {
    if (e.code === 'P2025') { res.status(404).json({ error: 'Trago no encontrado' }); return }
    throw e
  }
}
