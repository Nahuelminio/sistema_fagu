import { Request, Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'

const schema = z.object({ name: z.string().min(1) })

export async function getAll(_req: Request, res: Response): Promise<void> {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
  res.json(categories)
}

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Nombre requerido' })
    return
  }
  try {
    const category = await prisma.category.create({ data: parsed.data })
    res.status(201).json(category)
  } catch {
    res.status(409).json({ error: 'La categoría ya existe' })
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  try {
    await prisma.category.delete({ where: { id } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Categoría no encontrada o tiene productos asociados' })
  }
}
