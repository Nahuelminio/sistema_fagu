import { Response } from 'express'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'

/** Devuelve el inicio del día actual en Argentina (UTC-3, sin DST) */
function getArgentinaToday(): Date {
  const now = new Date()
  const argOffset = 3 * 60 * 60 * 1000 // UTC-3
  const argNow = new Date(now.getTime() - argOffset)
  const [year, month, day] = argNow.toISOString().slice(0, 10).split('-').map(Number)
  // medianoche Argentina = 03:00 UTC
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0))
}

export async function getDashboard(_req: AuthRequest, res: Response): Promise<void> {
  const today      = getArgentinaToday()
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Últimos 7 días
  const weekStart = new Date(today)
  weekStart.setDate(weekStart.getDate() - 6)

  const [
    totalProducts,
    allProducts,
    todaySales,
    monthIngresos,
    monthVentas,
    weekSalesRaw,
    topItemsRaw,
    paymentRaw,
    gastosMesAgg,
  ] = await Promise.all([
    prisma.product.count(),

    prisma.product.findMany({
      select: {
        id: true, name: true, unit: true,
        currentStock: true, minStock: true,
        category: { select: { name: true } },
      },
    }),

    // Ventas de hoy (count + revenue) — excluye anuladas
    prisma.sale.findMany({
      where: { createdAt: { gte: today }, anulada: false },
      select: { total: true },
    }),

    // Compras del mes
    prisma.stockMovement.findMany({
      where: { type: 'INGRESO', createdAt: { gte: monthStart } },
      select: { quantity: true, unitCost: true },
    }),

    // Ventas del mes — excluye anuladas
    prisma.sale.findMany({
      where: { createdAt: { gte: monthStart }, anulada: false },
      select: { total: true },
    }),

    // Ventas de los últimos 7 días — excluye anuladas
    prisma.sale.findMany({
      where: { createdAt: { gte: weekStart }, anulada: false },
      select: { total: true, createdAt: true },
    }),

    // Top productos/tragos del mes — excluye anuladas
    prisma.saleItem.findMany({
      where: { sale: { createdAt: { gte: monthStart }, anulada: false } },
      select: { nombre: true, quantity: true, unitPrice: true, productId: true, tragoId: true },
    }),

    // Ventas por método de pago del mes — excluye anuladas
    prisma.sale.groupBy({
      by: ['paymentMethod'],
      where: { createdAt: { gte: monthStart }, anulada: false },
      _count: { id: true },
      _sum: { total: true },
    }),

    // Gastos fijos del mes
    prisma.gastoMensual.aggregate({
      where: { mes: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` },
      _sum: { monto: true },
    }),
  ])

  // ── Procesar datos ────────────────────────────────────────────────────────

  const lowStockProducts = allProducts.filter(
    (p) => Number(p.currentStock) <= Number(p.minStock)
  )

  const costoMes   = monthIngresos.reduce((s, m) => s + Number(m.quantity) * Number(m.unitCost ?? 0), 0)
  const ventasMes  = monthVentas.reduce((s, v) => s + Number(v.total), 0)
  const gastosMes  = Number(gastosMesAgg._sum.monto ?? 0)
  const todayCount   = todaySales.length
  const todayRevenue = todaySales.reduce((s, v) => s + Number(v.total), 0)

  // Ventas por día (últimos 7 días)
  const weekMap: Record<string, { revenue: number; count: number }> = {}
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    weekMap[d.toISOString().slice(0, 10)] = { revenue: 0, count: 0 }
  }
  for (const s of weekSalesRaw) {
    const key = s.createdAt.toISOString().slice(0, 10)
    if (weekMap[key]) {
      weekMap[key].revenue += Number(s.total)
      weekMap[key].count   += 1
    }
  }
  const weekSales = Object.entries(weekMap).map(([date, v]) => ({ date, ...v }))

  // Top 5 items del mes — fallback de nombre para SaleItems antiguos (nombre vacío)
  const dashTragoIds   = [...new Set(topItemsRaw.filter((i) => i.tragoId).map((i) => i.tragoId!))]
  const dashProductIds = [...new Set(topItemsRaw.filter((i) => i.productId && !i.tragoId).map((i) => i.productId!))]
  const [dashTragos, dashProducts] = await Promise.all([
    dashTragoIds.length   ? prisma.trago.findMany({ where: { id: { in: dashTragoIds } }, select: { id: true, name: true } }) : [],
    dashProductIds.length ? prisma.product.findMany({ where: { id: { in: dashProductIds } }, select: { id: true, name: true } }) : [],
  ])
  const dashTragoMap   = new Map(dashTragos.map((t) => [t.id, t.name]))
  const dashProductMap = new Map(dashProducts.map((p) => [p.id, p.name]))

  const itemMap: Record<string, { nombre: string; qty: number; revenue: number }> = {}
  for (const item of topItemsRaw) {
    const resolvedNombre = item.nombre ||
      (item.tragoId   ? (dashTragoMap.get(item.tragoId)   ?? `Trago #${item.tragoId}`)   : '') ||
      (item.productId ? (dashProductMap.get(item.productId) ?? `Producto #${item.productId}`) : '')
    if (!resolvedNombre) continue
    const key = item.tragoId ? `t_${item.tragoId}` : item.productId ? `p_${item.productId}` : resolvedNombre
    if (!itemMap[key]) itemMap[key] = { nombre: resolvedNombre, qty: 0, revenue: 0 }
    itemMap[key].qty     += Number(item.quantity)
    itemMap[key].revenue += Number(item.quantity) * Number(item.unitPrice)
  }
  const topItems = Object.values(itemMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  // Métodos de pago
  const paymentBreakdown = paymentRaw.map((p) => ({
    method: p.paymentMethod,
    count:  p._count.id,
    total:  Number(p._sum.total ?? 0),
  }))

  res.json({
    totalProducts,
    lowStockProducts,
    today: { count: todayCount, revenue: todayRevenue },
    month: {
      costoCompras: costoMes,
      ventas:       ventasMes,
      gastos:       gastosMes,
      ganancia:     ventasMes - costoMes - gastosMes,
    },
    weekSales,
    topItems,
    paymentBreakdown,
  })
}

export async function getCierreCaja(req: AuthRequest, res: Response): Promise<void> {
  // Fecha del cierre: hoy por defecto, o ?date=YYYY-MM-DD
  const dateParam = req.query.date as string | undefined
  const base = dateParam ? new Date(dateParam) : new Date()
  const from = new Date(base); from.setHours(0, 0, 0, 0)
  const to   = new Date(base); to.setHours(23, 59, 59, 999)

  const [ventas, paymentRaw, topItemsRaw] = await Promise.all([
    prisma.sale.findMany({
      where: { createdAt: { gte: from, lte: to }, anulada: false },
      include: {
        items: { select: { nombre: true, quantity: true, unitPrice: true } },
        user:  { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),

    prisma.sale.groupBy({
      by: ['paymentMethod'],
      where: { createdAt: { gte: from, lte: to }, anulada: false },
      _count: { id: true },
      _sum:   { total: true },
    }),

    prisma.saleItem.findMany({
      where: { sale: { createdAt: { gte: from, lte: to }, anulada: false } },
      select: { nombre: true, quantity: true, unitPrice: true, productId: true, tragoId: true },
    }),
  ])

  const totalRevenue = ventas.reduce((s, v) => s + Number(v.total), 0)

  const paymentBreakdown = paymentRaw.map((p) => ({
    method: p.paymentMethod,
    count:  p._count.id,
    total:  Number(p._sum.total ?? 0),
  }))

  // Fallback de nombre para SaleItems antiguos (nombre vacío)
  const cierreTragoIds   = [...new Set(topItemsRaw.filter((i) => i.tragoId).map((i) => i.tragoId!))]
  const cierreProductIds = [...new Set(topItemsRaw.filter((i) => i.productId && !i.tragoId).map((i) => i.productId!))]
  const [cierreTragos, cierreProducts] = await Promise.all([
    cierreTragoIds.length   ? prisma.trago.findMany({ where: { id: { in: cierreTragoIds } }, select: { id: true, name: true } }) : [],
    cierreProductIds.length ? prisma.product.findMany({ where: { id: { in: cierreProductIds } }, select: { id: true, name: true } }) : [],
  ])
  const cierreTragoMap   = new Map(cierreTragos.map((t) => [t.id, t.name]))
  const cierreProductMap = new Map(cierreProducts.map((p) => [p.id, p.name]))

  const itemMap: Record<string, { nombre: string; qty: number; revenue: number }> = {}
  for (const item of topItemsRaw) {
    const resolvedNombre = item.nombre ||
      (item.tragoId   ? (cierreTragoMap.get(item.tragoId)   ?? `Trago #${item.tragoId}`)   : '') ||
      (item.productId ? (cierreProductMap.get(item.productId) ?? `Producto #${item.productId}`) : '')
    if (!resolvedNombre) continue
    const key = item.tragoId ? `t_${item.tragoId}` : item.productId ? `p_${item.productId}` : resolvedNombre
    if (!itemMap[key]) itemMap[key] = { nombre: resolvedNombre, qty: 0, revenue: 0 }
    itemMap[key].qty     += Number(item.quantity)
    itemMap[key].revenue += Number(item.quantity) * Number(item.unitPrice)
  }
  const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty)

  res.json({
    date: from.toISOString().slice(0, 10),
    totalVentas: ventas.length,
    totalRevenue,
    paymentBreakdown,
    topItems,
    ventas: ventas.map((v) => ({
      id: v.id,
      createdAt: v.createdAt,
      total: Number(v.total),
      paymentMethod: v.paymentMethod,
      user: v.user.name,
      items: v.items,
    })),
  })
}
