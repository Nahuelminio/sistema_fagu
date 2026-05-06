import { Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'

const gastoSchema = z.object({
  nombre: z.string().min(1),
  monto:  z.number().positive(),
  mes:    z.string().regex(/^\d{4}-\d{2}$/, 'Formato YYYY-MM'),
})

// ── GET /gastos/resumen?mes=YYYY-MM ──────────────────────────────────────────
export async function getResumenMensual(req: AuthRequest, res: Response): Promise<void> {
  const mes = (req.query.mes as string) ?? new Date().toISOString().slice(0, 7)

  const [year, month] = mes.split('-').map(Number)
  const from = new Date(year, month - 1, 1)
  const to   = new Date(year, month, 0, 23, 59, 59, 999)

  const [ventas, compras, gastos] = await Promise.all([
    // Ventas del mes
    prisma.sale.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { total: true, subtotal: true, discount: true },
    }),

    // Compras/ingresos del mes (costo mercadería)
    prisma.stockMovement.findMany({
      where: { type: 'INGRESO', createdAt: { gte: from, lte: to } },
      select: { quantity: true, unitCost: true },
    }),

    // Gastos variables cargados para ese mes
    prisma.gastoMensual.findMany({
      where: { mes },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const totalVentas     = ventas.reduce((s, v) => s + Number(v.total), 0)
  const cantVentas      = ventas.length
  const costoMercaderia = compras.reduce((s, m) => s + Number(m.quantity) * Number(m.unitCost ?? 0), 0)
  const totalGastos     = gastos.reduce((s, g) => s + Number(g.monto), 0)
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
    res.status(400).json({ error: 'Datos invalidos', details: parsed.error.flatten() })
    return
  }
  const gasto = await prisma.gastoMensual.create({ data: parsed.data })
  res.status(201).json({ ...gasto, monto: Number(gasto.monto) })
}

// ── DELETE /gastos/:id ────────────────────────────────────────────────────────
export async function deleteGasto(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  await prisma.gastoMensual.delete({ where: { id } })
  res.json({ ok: true })
}
