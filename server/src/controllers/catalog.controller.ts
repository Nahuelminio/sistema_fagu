import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { addClient } from '../services/sse.service'

/**
 * Devuelve el catálogo público:
 * - Productos visibles con stock > 0
 * - Tragos visibles activos cuyos ingredientes tengan stock (botella abierta o stock directo)
 * - Agrupados por categoría
 * - Categorías ordenadas por Category.order
 */
export async function getCatalog(_req: Request, res: Response): Promise<void> {
  const [products, tragos] = await Promise.all([
    prisma.product.findMany({
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
        imageUrl: true,
        category: { select: { id: true, name: true, order: true } },
      },
      orderBy: [{ category: { order: 'asc' } }, { category: { name: 'asc' } }, { name: 'asc' }],
    }),

    prisma.trago.findMany({
      where: {
        active: true,
        visibleInCatalog: true,
      },
      select: {
        id: true,
        name: true,
        salePrice: true,
        imageUrl: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    }),
  ])

  // Agrupar productos por categoría
  type CatItem = {
    type: 'product' | 'trago'
    id: number
    name: string
    salePrice: string | null
    imageUrl: string | null
    description?: string | null
    unit?: string
  }
  const grouped: Record<string, { order: number; items: CatItem[] }> = {}

  for (const p of products) {
    const cat = p.category.name
    if (!grouped[cat]) grouped[cat] = { order: p.category.order, items: [] }
    grouped[cat].items.push({
      type: 'product',
      id:   p.id,
      name: p.name,
      salePrice: p.salePrice ? String(p.salePrice) : null,
      imageUrl:  p.imageUrl,
      unit:      p.unit,
    })
  }

  // Los tragos en su propia categoría virtual al inicio
  if (tragos.length > 0) {
    grouped['Tragos'] = {
      order: -1, // siempre primero
      items: tragos.map<CatItem>((t) => ({
        type: 'trago',
        id:   t.id,
        name: t.name,
        salePrice: t.salePrice ? String(t.salePrice) : null,
        imageUrl:  t.imageUrl,
        description: t.description,
      })),
    }
  }

  // Ordenar categorías por order
  const sortedCategories = Object.entries(grouped)
    .sort(([, a], [, b]) => a.order - b.order)
    .reduce<Record<string, CatItem[]>>((acc, [name, { items }]) => {
      acc[name] = items
      return acc
    }, {})

  res.json({ categories: sortedCategories, updatedAt: new Date() })
}

export function catalogSSE(req: Request, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  res.write('data: {"type":"connected"}\n\n')
  addClient(res)
}
