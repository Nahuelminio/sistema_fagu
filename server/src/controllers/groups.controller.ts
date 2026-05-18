import { Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'

const groupSchema = z.object({
  name: z.string().min(1),
})

/** Lista todos los grupos con sus productos. */
export async function getGroups(_req: AuthRequest, res: Response): Promise<void> {
  const groups = await prisma.productGroup.findMany({
    orderBy: { name: 'asc' },
    include: {
      products: {
        select: { id: true, name: true, currentStock: true, unit: true, bottleSize: true },
        orderBy: { name: 'asc' },
      },
    },
  })
  res.json(groups)
}

export async function createGroup(req: AuthRequest, res: Response): Promise<void> {
  const parsed = groupSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return }

  try {
    const group = await prisma.productGroup.create({ data: parsed.data })
    res.status(201).json(group)
  } catch (e: any) {
    if (e.code === 'P2002') { res.status(400).json({ error: 'Ya existe un grupo con ese nombre' }); return }
    throw e
  }
}

export async function updateGroup(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return }

  const parsed = groupSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return }

  try {
    const group = await prisma.productGroup.update({ where: { id }, data: parsed.data })
    res.json(group)
  } catch (e: any) {
    if (e.code === 'P2025') { res.status(404).json({ error: 'Grupo no encontrado' }); return }
    if (e.code === 'P2002') { res.status(400).json({ error: 'Ya existe un grupo con ese nombre' }); return }
    throw e
  }
}

export async function deleteGroup(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return }

  // Desasociar productos antes de borrar
  await prisma.$transaction(async (tx) => {
    await tx.product.updateMany({ where: { grupoId: id }, data: { grupoId: null } })
    await tx.productGroup.delete({ where: { id } })
  })
  res.json({ ok: true })
}
