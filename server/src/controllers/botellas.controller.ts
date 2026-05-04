import { Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'

const botellaSchema = z.object({
  productId: z.number().int().positive(),
  capacidad: z.number().positive(),
  alertaOz:  z.number().positive().optional(),
})

const botellaInclude = {
  product: { select: { id: true, name: true, unit: true } },
}

export async function getBotellas(_req: AuthRequest, res: Response): Promise<void> {
  const botellas = await prisma.botellaActiva.findMany({
    include: botellaInclude,
    orderBy: { product: { name: 'asc' } },
  })
  res.json(botellas)
}

export async function abrirBotella(req: AuthRequest, res: Response): Promise<void> {
  const parsed = botellaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }

  const { productId, capacidad, alertaOz = 3 } = parsed.data

  const botella = await prisma.$transaction(async (tx) => {
    // Verificar si ya había una botella abierta para no duplicar stock
    const anterior = await tx.botellaActiva.findUnique({ where: { productId } })

    // Upsert: si ya existe la reemplaza (nueva botella)
    const b = await tx.botellaActiva.upsert({
      where:  { productId },
      update: { capacidad, restante: capacidad, alertaOz, abiertaEn: new Date() },
      create: { productId, capacidad, restante: capacidad, alertaOz },
      include: botellaInclude,
    })

    // Si no había botella previa (o la anterior está diferente), ingresamos la capacidad al stock
    // Si ya había una, restamos lo que quedaba y sumamos la nueva (reposición)
    const stockAnterior = anterior ? Number(anterior.restante) : 0
    const diferencia = capacidad - stockAnterior

    if (diferencia !== 0) {
      const type = diferencia > 0 ? 'INGRESO' : 'SALIDA'
      await tx.stockMovement.create({
        data: {
          productId,
          userId: req.user!.userId,
          type,
          quantity: Math.abs(diferencia),
          notes: anterior ? `Reposición de botella (${capacidad} oz)` : `Apertura de botella (${capacidad} oz)`,
        },
      })
      await tx.product.update({
        where: { id: productId },
        data: {
          currentStock: diferencia > 0
            ? { increment: diferencia }
            : { decrement: Math.abs(diferencia) },
        },
      })
    }

    return b
  })

  res.status(201).json(botella)
}

export async function cerrarBotella(req: AuthRequest, res: Response): Promise<void> {
  const productId = parseInt(req.params.productId)
  await prisma.botellaActiva.deleteMany({ where: { productId } })
  res.status(204).send()
}
