import { Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'
import { broadcastCatalogUpdate } from '../services/sse.service'
import { calcularCostoPromedioPonderado } from '../utils/weightedAverageCost'

const ingresoSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().positive(),
  unitCost: z.number().positive().optional(),
  notes: z.string().optional(),
})

const salidaSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().positive(),
  notes: z.string().optional(),
})

export async function registerIngreso(req: AuthRequest, res: Response): Promise<void> {
  const parsed = ingresoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }

  const { productId, quantity, unitCost, notes } = parsed.data

  const result = await prisma.$transaction(async (tx) => {
    // Estado actual para calcular costo promedio ponderado
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { currentStock: true, costPrice: true },
    })
    if (!product) throw new Error('Producto no encontrado')

    const nuevoCosto = calcularCostoPromedioPonderado({
      stockActual:   Number(product.currentStock),
      costoActual:   product.costPrice == null ? null : Number(product.costPrice),
      cantidadNueva: quantity,
      costoNuevo:    unitCost ?? null,
    })

    const movement = await tx.stockMovement.create({
      data: {
        productId,
        userId: req.user!.userId,
        type: 'INGRESO',
        quantity,
        unitCost,
        notes,
      },
      include: {
        product: { select: { id: true, name: true, unit: true } },
        user: { select: { id: true, name: true } },
      },
    })

    const updated = await tx.product.update({
      where: { id: productId },
      data: {
        currentStock: { increment: quantity },
        ...(nuevoCosto != null ? { costPrice: nuevoCosto } : {}),
      },
      select: { currentStock: true, costPrice: true },
    })

    return { movement, currentStock: updated.currentStock, costPrice: updated.costPrice }
  })

  broadcastCatalogUpdate()
  res.status(201).json(result)
}

export async function registerSalida(req: AuthRequest, res: Response): Promise<void> {
  const parsed = salidaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }

  const { productId, quantity, notes } = parsed.data

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) {
    res.status(404).json({ error: 'Producto no encontrado' })
    return
  }

  if (Number(product.currentStock) < quantity) {
    res.status(400).json({ error: 'Stock insuficiente', available: product.currentStock })
    return
  }

  const result = await prisma.$transaction(async (tx) => {
    const movement = await tx.stockMovement.create({
      data: {
        productId,
        userId: req.user!.userId,
        type: 'SALIDA',
        quantity,
        notes,
      },
      include: {
        product: { select: { id: true, name: true, unit: true } },
        user: { select: { id: true, name: true } },
      },
    })

    const updated = await tx.product.update({
      where: { id: productId },
      data: { currentStock: { decrement: quantity } },
      select: { currentStock: true },
    })

    return { movement, currentStock: updated.currentStock }
  })

  broadcastCatalogUpdate()
  res.status(201).json(result)
}

export async function getHistory(req: AuthRequest, res: Response): Promise<void> {
  const { productId, from, to, type, page = '1', limit = '50' } = req.query

  const where: Record<string, unknown> = {}

  if (req.user?.role === 'USER') {
    where.userId = req.user.userId
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    where.createdAt = { gte: today }
  } else {
    if (productId) where.productId = parseInt(productId as string)
    if (type) where.type = type
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from as string) } : {}),
        ...(to ? { lte: new Date(to as string) } : {}),
      }
    }
  }

  const pageNum = parseInt(page as string)
  const limitNum = parseInt(limit as string)

  const [movements, total] = await prisma.$transaction([
    prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, unit: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.stockMovement.count({ where }),
  ])

  res.json({ movements, total, page: pageNum, pages: Math.ceil(total / limitNum) })
}
