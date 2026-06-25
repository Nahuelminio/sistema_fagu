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
  if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return }

  // Detectar productos asociados ANTES de borrar para devolver mensaje claro
  const count = await prisma.product.count({ where: { categoryId: id } })
  if (count > 0) {
    res.status(409).json({
      error: `No se puede borrar: la categoría tiene ${count} producto(s) asociado(s). Movélos o eliminálos primero.`,
    })
    return
  }

  try {
    await prisma.category.delete({ where: { id } })
    res.status(204).send()
  } catch (e: any) {
    if (e.code === 'P2025') { res.status(404).json({ error: 'Categoría no encontrada' }); return }
    throw e
  }
}
