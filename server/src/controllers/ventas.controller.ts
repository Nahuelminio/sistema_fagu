import { Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'
import { broadcastCatalogUpdate } from '../services/sse.service'

const PAYMENT_METHODS = ['EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'MERCADOPAGO', 'CUENTA_CORRIENTE'] as const

const ventaSchema = z.object({
  items: z
    .array(
      z.union([
        z.object({ productId: z.number().int().positive(), quantity: z.number().positive() }),
        z.object({ tragoId: z.number().int().positive(), quantity: z.number().positive() }),
      ])
    )
    .min(1),
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

  // Separar ítems por tipo
  const productItems = items.filter((i): i is { productId: number; quantity: number } => 'productId' in i)
  const tragoItems   = items.filter((i): i is { tragoId: number; quantity: number }   => 'tragoId'   in i)

  // Cargar productos directos
  const products = productItems.length
    ? await prisma.product.findMany({ where: { id: { in: productItems.map((i) => i.productId) } } })
    : []

  // Cargar tragos con sus ingredientes
  const tragos = tragoItems.length
    ? await prisma.trago.findMany({
        where: { id: { in: tragoItems.map((i) => i.tragoId) } },
        include: { ingredientes: { include: { product: true } } },
      })
    : []

  // Validar que todos existan
  if (products.length !== productItems.length) {
    res.status(404).json({ error: 'Uno o más productos no encontrados' })
    return
  }
  if (tragos.length !== tragoItems.length) {
    res.status(404).json({ error: 'Uno o más tragos no encontrados' })
    return
  }

  // ── Validar stock de productos directos ──────────────────────────────────
  for (const item of productItems) {
    const product = products.find((p) => p.id === item.productId)!
    if (Number(product.currentStock) < item.quantity) {
      res.status(400).json({
        error: `Stock insuficiente para "${product.name}"`,
        available: product.currentStock,
      })
      return
    }
  }

  // ── Acumular requerimientos por ingrediente de tragos ────────────────────
  const stockRequerido = new Map<number, number>()
  for (const item of tragoItems) {
    const trago = tragos.find((t) => t.id === item.tragoId)!
    for (const ing of trago.ingredientes) {
      const prev = stockRequerido.get(ing.productId) ?? 0
      stockRequerido.set(ing.productId, prev + Number(ing.cantidad) * item.quantity)
    }
  }

  // ── Cargar botellas activas para los ingredientes ────────────────────────
  const ingredientIds = [...stockRequerido.keys()]
  const botellas = ingredientIds.length
    ? await prisma.botellaActiva.findMany({ where: { productId: { in: ingredientIds } } })
    : []
  const botellaMap = new Map(botellas.map((b) => [b.productId, b]))

  // ── Validar disponibilidad por ingrediente ───────────────────────────────
  // Con botella activa → verificar restante
  // Sin botella activa → verificar currentStock
  const sinBotella = ingredientIds.filter((id) => !botellaMap.has(id))
  const productsSinBotella = sinBotella.length
    ? await prisma.product.findMany({ where: { id: { in: sinBotella } } })
    : []

  for (const [productId, requerido] of stockRequerido.entries()) {
    const botella = botellaMap.get(productId)
    if (botella) {
      if (Number(botella.restante) < requerido) {
        const p = productsSinBotella.find((p) => p.id === productId)
          ?? tragos.flatMap((t) => t.ingredientes).find((i) => i.productId === productId)?.product
        res.status(400).json({
          error: `Botella insuficiente para "${p?.name ?? 'ingrediente'}" (quedan ${Number(botella.restante).toFixed(1)} oz, se necesitan ${requerido} oz)`,
          available: botella.restante,
          required: requerido,
        })
        return
      }
    } else {
      const product = productsSinBotella.find((p) => p.id === productId)
      if (!product || Number(product.currentStock) < requerido) {
        res.status(400).json({
          error: `Stock insuficiente para "${product?.name ?? 'ingrediente'}"`,
          available: product?.currentStock ?? 0,
          required: requerido,
        })
        return
      }
    }
  }

  // ── Calcular total ────────────────────────────────────────────────────────
  const totalProductos = productItems.reduce((sum, item) => {
    const p = products.find((p) => p.id === item.productId)!
    return sum + Number(p.salePrice ?? 0) * item.quantity
  }, 0)
  const totalTragos = tragoItems.reduce((sum, item) => {
    const t = tragos.find((t) => t.id === item.tragoId)!
    return sum + Number(t.salePrice ?? 0) * item.quantity
  }, 0)
  const total = totalProductos + totalTragos

  const sale = await prisma.$transaction(
    async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          userId: req.user!.userId,
          total,
          paymentMethod,
          notes,
          items: {
            create: [
              ...productItems.map((item) => {
                const p = products.find((p) => p.id === item.productId)!
                return {
                  productId: item.productId,
                  nombre: p.name,
                  quantity: item.quantity,
                  unitPrice: Number(p.salePrice ?? 0),
                }
              }),
              ...tragoItems.map((item) => {
                const t = tragos.find((t) => t.id === item.tragoId)!
                return {
                  tragoId: item.tragoId,
                  nombre: t.name,
                  quantity: item.quantity,
                  unitPrice: Number(t.salePrice ?? 0),
                }
              }),
            ],
          },
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, unit: true } },
              trago: { select: { id: true, name: true } },
            },
          },
          user: { select: { id: true, name: true } },
        },
      })

      // ── Productos directos: SALIDA de stock ──────────────────────────────
      const productOps = productItems.flatMap((item) => [
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

      // ── Ingredientes de tragos ────────────────────────────────────────────
      // Con botella activa  → solo descuenta restante (stock ya salió al abrir la botella)
      // Sin botella activa  → descuenta stock + movimiento SALIDA
      const tragoOps: Promise<unknown>[] = []

      for (const [productId, cantTotal] of stockRequerido.entries()) {
        const botella = botellaMap.get(productId)
        if (botella) {
          // Solo descuenta de la botella activa
          tragoOps.push(
            tx.botellaActiva.update({
              where: { id: botella.id },
              data: { restante: { decrement: cantTotal } },
            })
          )
        } else {
          // Sin botella: descuenta stock + movimiento
          const ingName = tragos
            .flatMap((t) => t.ingredientes)
            .find((i) => i.productId === productId)?.product.name ?? 'ingrediente'
          tragoOps.push(
            tx.stockMovement.create({
              data: {
                productId,
                userId: req.user!.userId,
                type: 'SALIDA',
                quantity: cantTotal,
                notes: `Venta #${newSale.id} — ${ingName}`,
              },
            }),
            tx.product.update({
              where: { id: productId },
              data: { currentStock: { decrement: cantTotal } },
            })
          )
        }
      }

      // Normalizar restante a 0 si quedó negativo (borde)
      await Promise.all([...productOps, ...tragoOps])
      await tx.botellaActiva.updateMany({
        where: { restante: { lt: 0 } },
        data:  { restante: 0 },
      })

      return newSale
    },
    { timeout: 20000 }
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
            trago: { select: { id: true, name: true } },
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

  res.json({ ventas, total, page: pageNum, pages: Math.ceil(total / limitNum), totalRevenue })
}
