import { Response } from 'express'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'

export async function getDashboard(_req: AuthRequest, res: Response): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  const [totalProducts, allProducts, todayVentas, monthIngresos, monthVentas] =
    await Promise.all([
      prisma.product.count(),

      prisma.product.findMany({
        select: {
          id: true,
          name: true,
          unit: true,
          currentStock: true,
          minStock: true,
          category: { select: { name: true } },
        },
      }),

      prisma.sale.count({ where: { createdAt: { gte: today } } }),

      prisma.stockMovement.findMany({
        where: { type: 'INGRESO', createdAt: { gte: monthStart } },
        select: { quantity: true, unitCost: true },
      }),

      prisma.sale.findMany({
        where: { createdAt: { gte: monthStart } },
        select: { total: true },
      }),
    ])

  const lowStockProducts = allProducts.filter(
    (p) => Number(p.currentStock) <= Number(p.minStock)
  )

  const costoMes = monthIngresos.reduce(
    (sum, m) => sum + Number(m.quantity) * Number(m.unitCost ?? 0),
    0
  )

  const ventasMes = monthVentas.reduce((sum, v) => sum + Number(v.total), 0)

  res.json({
    totalProducts,
    lowStockProducts,
    todayVentas,
    month: {
      costoCompras: costoMes,
      ventas: ventasMes,
      ganancia: ventasMes - costoMes,
    },
  })
}
