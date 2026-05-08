import { Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'
import { parseId } from '../utils/asyncHandler'

const gastoSchema = z.object({
  nombre: z.string().min(1),
  monto:  z.number().positive(),
  mes:    z.string().regex(/^\d{4}-\d{2}$/, 'Formato YYYY-MM'),
})

// ── GET /gastos/resumen?mes=YYYY-MM ──────────────────────────────────────────
export async function getResumenMensual(req: AuthRequest, res: Response): Promise<void> {
  const mes = (req.query.mes as string) ?? new Date().toISOString().slice(0, 7)

  // Validate mes format
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    res.status(400).json({ error: 'Formato de mes inválido. Use YYYY-MM' })
    return
  }

  const [year, month] = mes.split('-').map(Number)
  const from = new Date(year, month - 1, 1)
  const to   = new Date(year, month, 0, 23, 59, 59, 999)

  const [ventas, saleItems, gastos] = await Promise.all([
    // Ventas del mes
    prisma.sale.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { total: true },
    }),

    // Items vendidos ese mes
    prisma.saleItem.findMany({
      where: { sale: { createdAt: { gte: from, lte: to } } },
      select: { productId: true, tragoId: true, quantity: true },
    }),

    // Gastos variables cargados para ese mes
    prisma.gastoMensual.findMany({
      where: { mes },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  // Cargar costos de productos y tragos vendidos
  const productIds = [...new Set(saleItems.filter(i => i.productId).map(i => i.productId!))]
  const tragoIds   = [...new Set(saleItems.filter(i => i.tragoId).map(i => i.tragoId!))]

  const [products, tragos] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, costPrice: true },
        })
      : [],
    tragoIds.length
      ? prisma.trago.findMany({
          where: { id: { in: tragoIds } },
          include: {
            ingredientes: {
              include: {
                product: {
                  select: {
                    id: true, costPrice: true,
                    botellaActiva: { select: { capacidad: true } },
                  },
                },
              },
            },
          },
        })
      : [],
  ])

  const productMap = new Map(products.map(p => [p.id, p]))
  const tragoMap   = new Map(tragos.map(t => [t.id, t]))

  // Calcular costo de lo vendido (COGS)
  let costoMercaderia = 0
  for (const item of saleItems) {
    const qty = Number(item.quantity)
    if (item.productId) {
      const p = productMap.get(item.productId)
      costoMercaderia += Number(p?.costPrice ?? 0) * qty
    } else if (item.tragoId) {
      const t = tragoMap.get(item.tragoId)
      if (t) {
        const costoPorUnidad = t.ingredientes.reduce((sum, ing) => {
          const precio    = Number(ing.product.costPrice ?? 0)
          const capacidad = Number(ing.product.botellaActiva?.capacidad ?? 0)
          const ozCost    = capacidad > 0 ? precio / capacidad : 0
          return sum + Number(ing.cantidad) * ozCost
        }, 0)
        costoMercaderia += costoPorUnidad * qty
      }
    }
  }

  const totalVentas = ventas.reduce((s, v) => s + Number(v.total), 0)
  const cantVentas  = ventas.length
  const totalGastos = gastos.reduce((s, g) => s + Number(g.monto), 0)
  const gananciaBruta   = totalVentas - costoMercaderia
  const gananciaNeta    = gananciaBruta - totalGastos

  res.json({
    mes,
    cantVentas,
    totalVentas:     Math.round(totalVentas),
    costoMercaderia: Math.round(costoMercaderia),
    gananciaBruta:   Math.round(gananciaBruta),
    totalGastos:     Math.round(totalGastos),
    gananciaNeta:    Math.round(gananciaNeta),
    gastos: gastos.map((g) => ({ ...g, monto: Number(g.monto) })),
  })
}

// ── POST /gastos ─────────────────────────────────────────────────────────────
export async function createGasto(req: AuthRequest, res: Response): Promise<void> {
  const parsed = gastoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }
  const gasto = await prisma.gastoMensual.create({ data: parsed.data })
  res.status(201).json({ ...gasto, monto: Number(gasto.monto) })
}

// ── DELETE /gastos/:id ────────────────────────────────────────────────────────
export async function deleteGasto(req: AuthRequest, res: Response): Promise<void> {
  const id = parseId(req.params.id)
  if (!id) { res.status(400).json({ error: 'ID inválido' }); return }

  try {
    await prisma.gastoMensual.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e: any) {
    if (e.code === 'P2025') { res.status(404).json({ error: 'Gasto no encontrado' }); return }
    throw e
  }
}
