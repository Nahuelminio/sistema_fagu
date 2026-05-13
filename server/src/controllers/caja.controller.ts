import { Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'

const abrirSchema = z.object({
  fondoInicial: z.number().min(0),
  notas:        z.string().optional(),
})

const cerrarSchema = z.object({
  efectivoContado: z.number().min(0),
  notas:           z.string().optional(),
})

/**
 * Devuelve la caja abierta actualmente (si hay) con métricas en tiempo real.
 * Las ventas se asocian a la caja por cajaId, no por createdAt — más confiable.
 */
export async function getCajaActual(_req: AuthRequest, res: Response): Promise<void> {
  const caja = await prisma.caja.findFirst({
    where:   { status: 'ABIERTA' },
    orderBy: { fechaApertura: 'desc' },
    include: { user: { select: { id: true, name: true } } },
  })

  if (!caja) {
    res.json(null)
    return
  }

  // Ventas asociadas a esta caja específicamente (por cajaId)
  const ventas = await prisma.sale.findMany({
    where:  { cajaId: caja.id },
    select: { total: true, paymentMethod: true },
  })

  const totales: Record<string, number> = {}
  let efectivoVentas = 0
  let totalVentas    = 0
  for (const v of ventas) {
    const m = v.paymentMethod
    const t = Number(v.total)
    totales[m] = (totales[m] ?? 0) + t
    totalVentas += t
    if (m === 'EFECTIVO') efectivoVentas += t
  }

  const fondoInicial     = Number(caja.fondoInicial)
  const efectivoEsperado = fondoInicial + efectivoVentas

  res.json({
    ...caja,
    fondoInicial,
    metricas: {
      cantVentas:       ventas.length,
      totalVentas:      Math.round(totalVentas),
      efectivoVentas:   Math.round(efectivoVentas),
      efectivoEsperado: Math.round(efectivoEsperado),
      porMetodo:        Object.entries(totales).map(([m, t]) => ({ method: m, total: Math.round(t) })),
    },
  })
}

/** Abre una nueva caja. Falla si ya hay una abierta. (transaccional) */
export async function abrirCaja(req: AuthRequest, res: Response): Promise<void> {
  const parsed = abrirSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }

  try {
    const caja = await prisma.$transaction(async (tx) => {
      const existente = await tx.caja.findFirst({ where: { status: 'ABIERTA' } })
      if (existente) {
        throw Object.assign(new Error('Ya hay una caja abierta'), { code: 'CAJA_ABIERTA' })
      }
      return tx.caja.create({
        data: {
          userId:        req.user!.userId,
          fondoInicial:  parsed.data.fondoInicial,
          notasApertura: parsed.data.notas,
        },
        include: { user: { select: { id: true, name: true } } },
      })
    }, { timeout: 15000 })

    res.status(201).json(caja)
  } catch (err: any) {
    if (err.code === 'CAJA_ABIERTA') {
      res.status(400).json({ error: 'Ya hay una caja abierta. Cerrala antes de abrir otra.' })
      return
    }
    throw err
  }
}

/** Cierra la caja abierta. (transaccional para evitar doble cierre) */
export async function cerrarCaja(req: AuthRequest, res: Response): Promise<void> {
  const parsed = cerrarSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }

  try {
    const cerrada = await prisma.$transaction(async (tx) => {
      const caja = await tx.caja.findFirst({
        where:   { status: 'ABIERTA' },
        orderBy: { fechaApertura: 'desc' },
      })
      if (!caja) {
        throw Object.assign(new Error('No hay caja abierta'), { code: 'NO_CAJA' })
      }

      const ventas = await tx.sale.findMany({
        where:  { cajaId: caja.id, paymentMethod: 'EFECTIVO' },
        select: { total: true },
      })
      const efectivoVentas   = ventas.reduce((s, v) => s + Number(v.total), 0)
      const efectivoEsperado = Number(caja.fondoInicial) + efectivoVentas
      const diferencia       = parsed.data.efectivoContado - efectivoEsperado

      return tx.caja.update({
        where: { id: caja.id },
        data: {
          status:           'CERRADA',
          fechaCierre:      new Date(),
          efectivoEsperado,
          efectivoContado:  parsed.data.efectivoContado,
          diferencia,
          notasCierre:      parsed.data.notas,
        },
        include: { user: { select: { id: true, name: true } } },
      })
    }, { timeout: 15000 })

    res.json(cerrada)
  } catch (err: any) {
    if (err.code === 'NO_CAJA') {
      res.status(400).json({ error: 'No hay caja abierta' })
      return
    }
    throw err
  }
}

/** Reabre la última caja cerrada — solo admin, para corregir errores. */
export async function reabrirCaja(req: AuthRequest, res: Response): Promise<void> {
  const cajaId = parseInt(req.params.id)
  if (isNaN(cajaId)) { res.status(400).json({ error: 'ID inválido' }); return }

  try {
    const reabierta = await prisma.$transaction(async (tx) => {
      // No puede haber otra caja abierta
      const otra = await tx.caja.findFirst({ where: { status: 'ABIERTA' } })
      if (otra) {
        throw Object.assign(new Error('Ya hay una caja abierta'), { code: 'CAJA_ABIERTA' })
      }
      const caja = await tx.caja.findUnique({ where: { id: cajaId } })
      if (!caja) {
        throw Object.assign(new Error('Caja no encontrada'), { code: 'NOT_FOUND' })
      }
      return tx.caja.update({
        where: { id: cajaId },
        data: {
          status:           'ABIERTA',
          fechaCierre:      null,
          efectivoEsperado: null,
          efectivoContado:  null,
          diferencia:       null,
        },
        include: { user: { select: { id: true, name: true } } },
      })
    }, { timeout: 15000 })

    res.json(reabierta)
  } catch (err: any) {
    if (err.code === 'CAJA_ABIERTA') { res.status(400).json({ error: 'Hay otra caja abierta — cerrala primero' }); return }
    if (err.code === 'NOT_FOUND')    { res.status(404).json({ error: 'Caja no encontrada' }); return }
    throw err
  }
}

/** Listado histórico de cajas cerradas (admin-only). */
export async function getHistorialCajas(req: AuthRequest, res: Response): Promise<void> {
  const { from, to, limit = '30' } = req.query

  const where: Record<string, unknown> = { status: 'CERRADA' }
  if (from || to) {
    where.fechaApertura = {
      ...(from ? { gte: new Date(from as string) } : {}),
      ...(to   ? { lte: new Date(to   as string) } : {}),
    }
  }

  const cajas = await prisma.caja.findMany({
    where,
    orderBy: { fechaApertura: 'desc' },
    take:    Math.min(200, Math.max(1, parseInt(limit as string) || 30)),
    include: { user: { select: { id: true, name: true } } },
  })

  res.json(cajas)
}
