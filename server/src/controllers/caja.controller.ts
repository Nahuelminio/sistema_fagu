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
 * Devuelve la caja abierta actualmente (si hay) con sus métricas en tiempo real.
 * Si no hay caja abierta, devuelve null.
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

  // Calcular ventas desde que se abrió la caja
  const ventas = await prisma.sale.findMany({
    where:  { createdAt: { gte: caja.fechaApertura } },
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

/** Abre una nueva caja. Falla si ya hay una abierta. */
export async function abrirCaja(req: AuthRequest, res: Response): Promise<void> {
  const parsed = abrirSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }

  const existente = await prisma.caja.findFirst({ where: { status: 'ABIERTA' } })
  if (existente) {
    res.status(400).json({ error: 'Ya hay una caja abierta. Cerrala antes de abrir otra.' })
    return
  }

  const caja = await prisma.caja.create({
    data: {
      userId:        req.user!.userId,
      fondoInicial:  parsed.data.fondoInicial,
      notasApertura: parsed.data.notas,
    },
    include: { user: { select: { id: true, name: true } } },
  })

  res.status(201).json(caja)
}

/** Cierra la caja abierta. Calcula efectivo esperado, diferencia y guarda el reporte. */
export async function cerrarCaja(req: AuthRequest, res: Response): Promise<void> {
  const parsed = cerrarSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }

  const caja = await prisma.caja.findFirst({
    where:   { status: 'ABIERTA' },
    orderBy: { fechaApertura: 'desc' },
  })
  if (!caja) {
    res.status(400).json({ error: 'No hay caja abierta' })
    return
  }

  // Sumar ventas en efectivo desde que se abrió
  const ventas = await prisma.sale.findMany({
    where:  {
      createdAt:     { gte: caja.fechaApertura },
      paymentMethod: 'EFECTIVO',
    },
    select: { total: true },
  })
  const efectivoVentas   = ventas.reduce((s, v) => s + Number(v.total), 0)
  const efectivoEsperado = Number(caja.fondoInicial) + efectivoVentas
  const diferencia       = parsed.data.efectivoContado - efectivoEsperado

  const cerrada = await prisma.caja.update({
    where: { id: caja.id },
    data: {
      status:          'CERRADA',
      fechaCierre:     new Date(),
      efectivoEsperado: efectivoEsperado,
      efectivoContado:  parsed.data.efectivoContado,
      diferencia,
      notasCierre:     parsed.data.notas,
    },
    include: { user: { select: { id: true, name: true } } },
  })

  res.json(cerrada)
}

/** Listado histórico de cajas cerradas. */
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
