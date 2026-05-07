import { Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'

const clienteSchema = z.object({
  nombre:  z.string().min(1),
  cuit:    z.string().optional(),
  dni:     z.string().optional(),
  email:   z.string().email().optional().or(z.literal('')),
  phone:   z.string().optional(),
  address: z.string().optional(),
})

export async function getClientes(_req: AuthRequest, res: Response): Promise<void> {
  const clientes = await prisma.cliente.findMany({ orderBy: { nombre: 'asc' } })
  res.json(clientes)
}

export async function createCliente(req: AuthRequest, res: Response): Promise<void> {
  const parsed = clienteSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos invalidos', details: parsed.error.flatten() })
    return
  }
  const data = { ...parsed.data, email: parsed.data.email || undefined }
  const cliente = await prisma.cliente.create({ data })
  res.status(201).json(cliente)
}

export async function updateCliente(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  const parsed = clienteSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos invalidos' })
    return
  }
  const data = { ...parsed.data, email: parsed.data.email || undefined }
  const cliente = await prisma.cliente.update({ where: { id }, data })
  res.json(cliente)
}

export async function deleteCliente(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  await prisma.cliente.delete({ where: { id } })
  res.json({ ok: true })
}
