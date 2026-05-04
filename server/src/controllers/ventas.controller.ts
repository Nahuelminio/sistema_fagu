import { Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'
import { broadcastCatalogUpdate } from '../services/sse.service'

const PAYMENT_METHODS = ['EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'MERCADOPAGO', 'CUENTA_CORRIENTE'] as const

const ventaSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().positive(),
      })
    )
    .min(1, 'Debe incluir al menos un producto'),
  paymentMethod: z.enum(PAYMENT_METHODS).default('EFECTIVO'),
  notes: z.string().optional(),
})

export async function createVenta(req: AuthRequest, res: Response): Promise<void> {
  const parsed = ventaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }

  const { items, paymentMethod, notes } = parsed.data

  // Obtener productos para validar stock y precios
  const productIds = items.map((i) => i.productId)
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } })

  if (products.length !== productIds.length) {
    res.status(404).json({ error: 'Uno o más productos no encontrados' })
    return
  }

  // Validar stock suficiente
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId)!
    if (Number(product.currentStock) < item.quantity) {
      res.status(400).json({
        error: `Stock insuficiente para "${product.name}"`,
        available: product.currentStock,
        productId: product.id,
      })
      return
    }
  }

  // Calcular total
  const total = items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId)!
    return sum + Number(product.salePrice ?? 0) * item.quantity
  }, 0)

  const sale = await prisma.$transaction(
    async (tx) => {
      // Crear la venta con sus ítems
      const newSale = await tx.sale.create({
        data: {
          userId: req.user!.userId,
          total,
          paymentMethod,
          notes,
          items: {
            create: items.map((item) => {
              const product = products.find((p) => p.id === item.productId)!
              return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: Number(product.salePrice ?? 0),
              }
            }),
          },
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, unit: true } },
            },
          },
          user: { select: { id: true, name: true } },
        },
      })

      // Crear movimientos SALIDA y decrementar stock en paralelo
      await Promise.all(
        items.flatMap((item) => [
          tx.stockMovement.create({
            data: {
              productId: item.productId,
              userId: req.user!.userId,
              type: 'SALIDA',
              quantity: item.quantity,
              notes: `Venta #${newSale.id}`,
            },
          }),
          tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { decrement: item.quantity } },
          }),
        ])
      )

      return newSale
    },
    { timeout: 15000 }
  )

  broadcastCatalogUpdate()
  res.status(201).json(sale)
}

export async function getVentas(req: AuthRequest, res: Response): Promise<void> {
  const { from, to, page = '1', limit = '50' } = req.query

  const where: Record<string, unknown> = {}

  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from as string) } : {}),
      ...(to ? { lte: new Date(to as string) } : {}),
    }
  }

  const pageNum = parseInt(page as string)
  const limitNum = parseInt(limit as string)

  const [ventas, total] = await prisma.$transaction([
    prisma.sale.findMany({
      where,
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, unit: true } },
          },
        },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.sale.count({ where }),
  ])

  const totalRevenue = ventas.reduce((sum, v) => sum + Number(v.total), 0)

  res.json({
    ventas,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    totalRevenue,
  })
}
