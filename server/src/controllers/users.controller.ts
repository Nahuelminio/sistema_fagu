import { Response } from 'express'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'

export async function getAll(_req: AuthRequest, res: Response): Promise<void> {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { name: 'asc' },
  })
  res.json(users)
}

export async function toggleActive(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  if (id === req.user!.userId) {
    res.status(400).json({ error: 'No podés desactivar tu propia cuenta' })
    return
  }

  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id } })
    const updated = await prisma.user.update({
      where: { id },
      data: { active: !user.active },
      select: { id: true, name: true, email: true, role: true, active: true },
    })
    res.json(updated)
  } catch {
    res.status(404).json({ error: 'Usuario no encontrado' })
  }
}
