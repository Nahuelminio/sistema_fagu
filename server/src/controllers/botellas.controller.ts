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

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) { res.status(404).json({ error: 'Producto no encontrado' }); return }

  // Snapshot del descarte previo (si había) — la fuente real se vuelve a leer en la transacción
  const previa = await prisma.botellaActiva.findUnique({ where: { productId } })
  const ozDescartados = previa ? Number(previa.restante) : 0

  try {
    const botella = await prisma.$transaction(async (tx) => {
      // ── Decremento ATÓMICO de stock con guard (anti race) ───────────────
      const upd = await tx.product.updateMany({
        where: { id: productId, currentStock: { gte: 1 } },
        data:  { currentStock: { decrement: 1 } },
      })
      if (upd.count === 0) {
        throw Object.assign(new Error(), { code: 'NO_STOCK' })
      }

      // Registrar oz perdidos (si los había)
      if (ozDescartados > 0) {
        await tx.stockMovement.create({
          data: {
            productId,
            userId: req.user!.userId,
            type: 'AJUSTE',
            quantity: ozDescartados,
            notes: `Descarte: botella anterior cerrada con ${ozDescartados.toFixed(2)} oz sin usar`,
          },
        })
      }

      const b = await tx.botellaActiva.upsert({
        where:  { productId },
        update: { capacidad, restante: capacidad, alertaOz, abiertaEn: new Date() },
        create: { productId, capacidad, restante: capacidad, alertaOz },
        include: botellaInclude,
      })

      await tx.stockMovement.create({
        data: {
          productId,
          userId: req.user!.userId,
          type: 'SALIDA',
          quantity: 1,
          notes: `Apertura de botella (${capacidad} oz)`,
        },
      })

      return b
    }, { timeout: 15000 })

    res.status(201).json({ ...botella, ozDescartados })
  } catch (err: any) {
    if (err.code === 'NO_STOCK') {
      res.status(400).json({ error: `No hay botellas cerradas de "${product.name}"` })
      return
    }
    throw err
  }
}

export async function cerrarBotella(req: AuthRequest, res: Response): Promise<void> {
  const productId = parseInt(req.params.productId)
  if (isNaN(productId)) { res.status(400).json({ error: 'ID inválido' }); return }

  await prisma.$transaction(async (tx) => {
    const botella = await tx.botellaActiva.findUnique({
      where: { productId },
      include: { product: { select: { name: true } } },
    })
    if (!botella) return

    const ozRemanente = Number(botella.restante)
    // Log de ajuste: dejamos rastro de cuántos oz se descartaron al cerrar la botella
    if (ozRemanente > 0) {
      await tx.stockMovement.create({
        data: {
          productId,
          userId: req.user!.userId,
          type: 'AJUSTE',
          quantity: ozRemanente,
          notes: `Cierre manual de botella (${botella.product.name}): ${ozRemanente.toFixed(2)} oz descartados`,
        },
      })
    }
    await tx.botellaActiva.delete({ where: { id: botella.id } })
  }, { timeout: 10000 })

  res.status(204).send()
}
