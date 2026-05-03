import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { addClient } from '../services/sse.service'

export async function getCatalog(_req: Request, res: Response): Promise<void> {
  const products = await prisma.product.findMany({
    where: {
      visibleInCatalog: true,
      currentStock: { gt: 0 },
    },
    select: {
      id: true,
      name: true,
      unit: true,
      currentStock: true,
      salePrice: true,
      category: { select: { id: true, name: true } },
    },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
  })

  const grouped = products.reduce<Record<string, typeof products>>((acc, p) => {
    const cat = p.category.name
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  res.json({ categories: grouped, updatedAt: new Date() })
}

export function catalogSSE(req: Request, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  res.write('data: {"type":"connected"}\n\n')
  addClient(res)
}
