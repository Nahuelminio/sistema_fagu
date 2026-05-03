import { Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'

const productSchema = z.object({
  name: z.string().min(1),
  categoryId: z.number().int().positive(),
  unit: z.string().min(1),
  minStock: z.number().min(0).default(0),
  costPrice: z.number().positive().optional(),
  salePrice: z.number().positive().optional(),
  visibleInCatalog: z.boolean().default(false),
})

const productSelect = {
  id: true,
  name: true,
  unit: true,
  currentStock: true,
  minStock: true,
  costPrice: true,
  salePrice: true,
  visibleInCatalog: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
}

export async function getAll(_req: AuthRequest, res: Response): Promise<void> {
  const products = await prisma.product.findMany({
    select: productSelect,
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
  })
  res.json(products)
}

export async function getOne(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  const product = await prisma.product.findUnique({ where: { id }, select: productSelect })
  if (!product) {
    res.status(404).json({ error: 'Producto no encontrado' })
    return
  }
  res.json(product)
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
  const parsed = productSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }

  const product = await prisma.product.create({
    data: parsed.data,
    select: productSelect,
  })
  res.status(201).json(product)
}

export async function update(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  const parsed = productSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }

  try {
    const product = await prisma.product.update({
      where: { id },
      data: parsed.data,
      select: productSelect,
    })
    res.json(product)
  } catch {
    res.status(404).json({ error: 'Producto no encontrado' })
  }
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  try {
    await prisma.product.delete({ where: { id } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Producto no encontrado' })
  }
}
