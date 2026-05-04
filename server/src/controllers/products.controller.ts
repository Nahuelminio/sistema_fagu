import { Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'

const productSchema = z.object({
  name: z.string().min(1),
  categoryId: z.number().int().positive(),
  unit: z.string().min(1),
  minStock: z.number().min(0).default(0),
  costPrice: z.number().positive().optional(),
  salePrice: z.number().positive().optional(),
  visibleInCatalog: z.boolean().default(false),
})

const productSelect = {
  id: true,
  name: true,
  unit: true,
  currentStock: true,
  minStock: true,
  costPrice: true,
  salePrice: true,
  visibleInCatalog: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
}

export async function getAll(_req: AuthRequest, res: Response): Promise<void> {
  const products = await prisma.product.findMany({
    select: productSelect,
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
  })
  res.json(products)
}

export async function getOne(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  const product = await prisma.product.findUnique({ where: { id }, select: productSelect })
  if (!product) {
    res.status(404).json({ error: 'Producto no encontrado' })
    return
  }
  res.json(product)
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
  const parsed = productSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }

  const product = await prisma.product.create({
    data: parsed.data,
    select: productSelect,
  })
  res.status(201).json(product)
}

export async function update(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  const parsed = productSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }

  try {
    const product = await prisma.product.update({
      where: { id },
      data: parsed.data,
      select: productSelect,
    })
    res.json(product)
  } catch {
    res.status(404).json({ error: 'Producto no encontrado' })
  }
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  try {
    await prisma.product.delete({ where: { id } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Producto no encontrado' })
  }
}

// Fusiona removeId en keepId: reasigna todas las FK y suma el stock
export async function mergeProducts(req: AuthRequest, res: Response): Promise<void> {
  const { keepId, removeId } = req.body as { keepId: number; removeId: number }

  if (!keepId || !removeId || keepId === removeId) {
    res.status(400).json({ error: 'keepId y removeId deben ser distintos y válidos' })
    return
  }

  const [keep, remove] = await Promise.all([
    prisma.product.findUnique({ where: { id: keepId } }),
    prisma.product.findUnique({ where: { id: removeId } }),
  ])
  if (!keep || !remove) {
    res.status(404).json({ error: 'Uno o ambos productos no encontrados' })
    return
  }

  await prisma.$transaction(async (tx) => {
    // Reasignar movimientos de stock
    await tx.stockMovement.updateMany({ where: { productId: removeId }, data: { productId: keepId } })

    // Reasignar ítems de venta
    await tx.saleItem.updateMany({ where: { productId: removeId }, data: { productId: keepId } })

    // Reasignar ingredientes de tragos
    // Si ya existe la combinación (keepId, tragoId), eliminar el duplicado
    const ingKeep = await tx.tragoBotella.findMany({ where: { productId: keepId }, select: { tragoId: true } })
    const tragoIdsKeep = new Set(ingKeep.map((i) => i.tragoId))
    await tx.tragoBotella.deleteMany({
      where: { productId: removeId, tragoId: { in: [...tragoIdsKeep] } },
    })
    await tx.tragoBotella.updateMany({ where: { productId: removeId }, data: { productId: keepId } })

    // Botellas activas: si keep ya tiene, eliminar la del remove; si no, reasignar
    const botellaKeep = await tx.botellaActiva.findUnique({ where: { productId: keepId } })
    if (botellaKeep) {
      await tx.botellaActiva.deleteMany({ where: { productId: removeId } })
    } else {
      await tx.botellaActiva.updateMany({ where: { productId: removeId }, data: { productId: keepId } })
    }

    // Sumar el stock del duplicado al que se queda
    await tx.product.update({
      where: { id: keepId },
      data: { currentStock: { increment: remove.currentStock } },
    })

    // Eliminar el duplicado
    await tx.product.delete({ where: { id: removeId } })
  })

  const result = await prisma.product.findUnique({ where: { id: keepId }, select: productSelect })
  res.json(result)
}
