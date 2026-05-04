import { Response } from 'express'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'

export async function getDashboard(_req: AuthRequest, res: Response): Promise<void> {
  const now   = new Date()
  const today = new Date(now); today.setHours(0, 0, 0, 0)
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
  ] = await Promise.all([
    prisma.product.count(),

    prisma.product.findMany({
      select: {
        id: true, name: true, unit: true,
        currentStock: true, minStock: true,
        category: { select: { name: true } },
      },
    }),

    // Ventas de hoy (count + revenue)
    prisma.sale.findMany({
      where: { createdAt: { gte: today } },
      select: { total: true },
    }),

    // Compras del mes
    prisma.stockMovement.findMany({
      where: { type: 'INGRESO', createdAt: { gte: monthStart } },
      select: { quantity: true, unitCost: true },
    }),

    // Ventas del mes
    prisma.sale.findMany({
      where: { createdAt: { gte: monthStart } },
      select: { total: true },
    }),

    // Ventas de los últimos 7 días
    prisma.sale.findMany({
      where: { createdAt: { gte: weekStart } },
      select: { total: true, createdAt: true },
    }),

    // Top productos/tragos del mes (por cantidad vendida)
    prisma.saleItem.findMany({
      where: { sale: { createdAt: { gte: monthStart } } },
      select: { nombre: true, quantity: true, unitPrice: true },
    }),

    // Ventas por método de pago del mes
    prisma.sale.groupBy({
      by: ['paymentMethod'],
      where: { createdAt: { gte: monthStart } },
      _count: { id: true },
      _sum: { total: true },
    }),
  ])

  // ── Procesar datos ────────────────────────────────────────────────────────

  const lowStockProducts = allProducts.filter(
    (p) => Number(p.currentStock) <= Number(p.minStock)
  )

  const costoMes   = monthIngresos.reduce((s, m) => s + Number(m.quantity) * Number(m.unitCost ?? 0), 0)
  const ventasMes  = monthVentas.reduce((s, v) => s + Number(v.total), 0)
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

  // Top 5 items del mes
  const itemMap: Record<string, { nombre: string; qty: number; revenue: number }> = {}
  for (const item of topItemsRaw) {
    const key = item.nombre
    if (!itemMap[key]) itemMap[key] = { nombre: item.nombre, qty: 0, revenue: 0 }
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
      ganancia:     ventasMes - costoMes,
    },
    weekSales,
    topItems,
    paymentBreakdown,
  })
}
