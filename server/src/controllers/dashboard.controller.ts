import { Response } from 'express'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'

export async function getDashboard(_req: AuthRequest, res: Response): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  const [totalProducts, allProducts, todayMovements, monthIngresos, monthSalidas] =
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

      prisma.stockMovement.count({ where: { createdAt: { gte: today } } }),

      prisma.stockMovement.findMany({
        where: { type: 'INGRESO', createdAt: { gte: monthStart } },
        select: { quantity: true, unitCost: true },
      }),

      prisma.stockMovement.findMany({
        where: { type: 'SALIDA', createdAt: { gte: monthStart } },
        include: { product: { select: { salePrice: true, costPrice: true } } },
      }),
    ])

  const lowStockProducts = allProducts.filter(
    (p) => Number(p.currentStock) <= Number(p.minStock)
  )

  const costoMes = monthIngresos.reduce(
    (sum, m) => sum + Number(m.quantity) * Number(m.unitCost ?? 0),
    0
  )

  const ventasMes = monthSalidas.reduce(
    (sum, m) => sum + Number(m.quantity) * Number(m.product.salePrice ?? 0),
    0
  )

  res.json({
    totalProducts,
    lowStockProducts,
    todayMovements,
    month: {
      costoCompras: costoMes,
      ventasEstimadas: ventasMes,
      gananciaEstimada: ventasMes - costoMes,
    },
  })
}
