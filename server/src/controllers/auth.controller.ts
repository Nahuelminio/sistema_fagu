import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import prisma from '../lib/prisma'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'USER']).default('USER'),
})

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }

  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || !user.active) {
    res.status(401).json({ error: 'Credenciales inválidas' })
    return
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    res.status(401).json({ error: 'Credenciales inválidas' })
    return
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  )

  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
}

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }

  const { email, name, password, role } = parsed.data

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) {
    res.status(409).json({ error: 'El email ya está registrado' })
    return
  }

  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, name, password: hashed, role },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })

  res.status(201).json(user)
}
