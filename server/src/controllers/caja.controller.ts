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

const movimientoSchema = z.object({
  tipo:   z.enum(['RETIRO', 'APORTE']),
  monto:  z.number().positive(),
  motivo: z.string().optional(),
})

/** Calcula efectivo esperado de una caja: fondo + ventas efectivo + aportes - retiros */
function calcularEfectivoEsperado(
  fondo: number,
  ventasEfectivo: number,
  movimientos: { tipo: string; monto: number }[],
): number {
  const aportes = movimientos.filter(m => m.tipo === 'APORTE').reduce((s, m) => s + Number(m.monto), 0)
  const retiros = movimientos.filter(m => m.tipo === 'RETIRO').reduce((s, m) => s + Number(m.monto), 0)
  return fondo + ventasEfectivo + aportes - retiros
}

/**
 * Devuelve la caja abierta actualmente (si hay) con métricas en tiempo real.
 */
export async function getCajaActual(_req: AuthRequest, res: Response): Promise<void> {
  const caja = await prisma.caja.findFirst({
    where:   { status: 'ABIERTA' },
    orderBy: { fechaApertura: 'desc' },
    include: {
      user: { select: { id: true, name: true } },
      movimientos: {
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  })

  if (!caja) {
    res.json(null)
    return
  }

  const ventas = await prisma.sale.findMany({
    where:  { cajaId: caja.id, anulada: false },
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

  const fondoInicial = Number(caja.fondoInicial)
  const totalAportes = caja.movimientos.filter(m => m.tipo === 'APORTE').reduce((s, m) => s + Number(m.monto), 0)
  const totalRetiros = caja.movimientos.filter(m => m.tipo === 'RETIRO').reduce((s, m) => s + Number(m.monto), 0)
  const efectivoEsperado = fondoInicial + efectivoVentas + totalAportes - totalRetiros

  res.json({
    ...caja,
    fondoInicial,
    metricas: {
      cantVentas:       ventas.length,
      totalVentas:      Math.round(totalVentas),
      efectivoVentas:   Math.round(efectivoVentas),
      totalAportes:     Math.round(totalAportes),
      totalRetiros:     Math.round(totalRetiros),
      efectivoEsperado: Math.round(efectivoEsperado),
      porMetodo:        Object.entries(totales).map(([m, t]) => ({ method: m, total: Math.round(t) })),
    },
  })
}

export async function abrirCaja(req: AuthRequest, res: Response): Promise<void> {
  const parsed = abrirSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return }

  try {
    const caja = await prisma.$transaction(async (tx) => {
      const existente = await tx.caja.findFirst({ where: { status: 'ABIERTA' } })
      if (existente) throw Object.assign(new Error(), { code: 'CAJA_ABIERTA' })
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

export async function cerrarCaja(req: AuthRequest, res: Response): Promise<void> {
  const parsed = cerrarSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return }

  try {
    const cerrada = await prisma.$transaction(async (tx) => {
      const caja = await tx.caja.findFirst({
        where:   { status: 'ABIERTA' },
        orderBy: { fechaApertura: 'desc' },
        include: { movimientos: true },
      })
      if (!caja) throw Object.assign(new Error(), { code: 'NO_CAJA' })

      const ventas = await tx.sale.findMany({
        where:  { cajaId: caja.id, paymentMethod: 'EFECTIVO', anulada: false },
        select: { total: true },
      })
      const efectivoVentas   = ventas.reduce((s, v) => s + Number(v.total), 0)
      const efectivoEsperado = calcularEfectivoEsperado(
        Number(caja.fondoInicial),
        efectivoVentas,
        caja.movimientos.map(m => ({ tipo: m.tipo, monto: Number(m.monto) })),
      )
      const diferencia = parsed.data.efectivoContado - efectivoEsperado

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
        include: {
          user: { select: { id: true, name: true } },
          movimientos: { include: { user: { select: { id: true, name: true } } } },
        },
      })
    }, { timeout: 15000 })
    res.json(cerrada)
  } catch (err: any) {
    if (err.code === 'NO_CAJA') { res.status(400).json({ error: 'No hay caja abierta' }); return }
    throw err
  }
}

export async function reabrirCaja(req: AuthRequest, res: Response): Promise<void> {
  const cajaId = parseInt(req.params.id)
  if (isNaN(cajaId)) { res.status(400).json({ error: 'ID inválido' }); return }

  try {
    const reabierta = await prisma.$transaction(async (tx) => {
      const otra = await tx.caja.findFirst({ where: { status: 'ABIERTA' } })
      if (otra) throw Object.assign(new Error(), { code: 'CAJA_ABIERTA' })
      const caja = await tx.caja.findUnique({ where: { id: cajaId } })
      if (!caja) throw Object.assign(new Error(), { code: 'NOT_FOUND' })
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

/** Registra un retiro o aporte de efectivo en la caja abierta actual. */
export async function registrarMovimiento(req: AuthRequest, res: Response): Promise<void> {
  const parsed = movimientoSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return }

  try {
    const mov = await prisma.$transaction(async (tx) => {
      const caja = await tx.caja.findFirst({ where: { status: 'ABIERTA' } })
      if (!caja) throw Object.assign(new Error(), { code: 'NO_CAJA' })
      return tx.movimientoCaja.create({
        data: {
          cajaId: caja.id,
          userId: req.user!.userId,
          tipo:   parsed.data.tipo,
          monto:  parsed.data.monto,
          motivo: parsed.data.motivo,
        },
        include: { user: { select: { id: true, name: true } } },
      })
    }, { timeout: 15000 })
    res.status(201).json(mov)
  } catch (err: any) {
    if (err.code === 'NO_CAJA') { res.status(400).json({ error: 'No hay caja abierta' }); return }
    throw err
  }
}

/** Elimina un movimiento (solo si la caja sigue abierta y solo admin). */
export async function deleteMovimiento(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return }

  const mov = await prisma.movimientoCaja.findUnique({
    where: { id },
    include: { caja: true },
  })
  if (!mov) { res.status(404).json({ error: 'Movimiento no encontrado' }); return }
  if (mov.caja.status === 'CERRADA') {
    res.status(400).json({ error: 'No se puede eliminar un movimiento de una caja cerrada' }); return
  }

  await prisma.movimientoCaja.delete({ where: { id } })
  res.json({ ok: true })
}

/** Listado histórico de cajas cerradas (admin-only). */
export async function getHistorialCajas(req: AuthRequest, res: Response): Promise<void> {
  const { from, to, userId, limit = '30' } = req.query

  const where: Record<string, unknown> = { status: 'CERRADA' }
  if (from || to) {
    where.fechaApertura = {
      ...(from ? { gte: new Date(from as string) } : {}),
      ...(to   ? { lte: new Date(to   as string) } : {}),
    }
  }
  if (userId) where.userId = parseInt(userId as string)

  const cajas = await prisma.caja.findMany({
    where,
    orderBy: { fechaApertura: 'desc' },
    take:    Math.min(200, Math.max(1, parseInt(limit as string) || 30)),
    include: {
      user:        { select: { id: true, name: true } },
      movimientos: { include: { user: { select: { id: true, name: true } } } },
    },
  })

  // Agregar ventas de cada caja
  const cajasConVentas = await Promise.all(
    cajas.map(async (caja) => {
      const ventas = await prisma.sale.findMany({
        where:  { cajaId: caja.id, anulada: false },
        select: { total: true, paymentMethod: true },
      })
      const porMetodo: Record<string, number> = {}
      let totalVentas = 0
      for (const v of ventas) {
        const t = Number(v.total)
        porMetodo[v.paymentMethod] = (porMetodo[v.paymentMethod] ?? 0) + t
        totalVentas += t
      }
      return {
        ...caja,
        cantVentas: ventas.length,
        totalVentas: Math.round(totalVentas),
        ventasPorMetodo: Object.entries(porMetodo).map(([method, total]) => ({ method, total: Math.round(total) })),
      }
    }),
  )

  // Stats agregadas
  const totalAcumulado = cajasConVentas.reduce((s, c) => s + c.totalVentas, 0)
  const diferenciaAcum = cajasConVentas.reduce((s, c) => s + Number(c.diferencia ?? 0), 0)

  res.json({
    cajas: cajasConVentas,
    stats: {
      cantCierres:      cajasConVentas.length,
      totalAcumulado:   Math.round(totalAcumulado),
      diferenciaAcumulada: Math.round(diferenciaAcum),
    },
  })
}

/** Detalle de un cierre puntual (para imprimir). Admin-only. */
export async function getCierreDetalle(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return }

  const caja = await prisma.caja.findUnique({
    where: { id },
    include: {
      user:        { select: { id: true, name: true } },
      movimientos: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
    },
  })
  if (!caja) { res.status(404).json({ error: 'Caja no encontrada' }); return }

  const ventas = await prisma.sale.findMany({
    where:  { cajaId: caja.id, anulada: false },
    select: { id: true, total: true, paymentMethod: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const porMetodo: Record<string, { count: number; total: number }> = {}
  let totalVentas = 0
  let efectivoVentas = 0
  for (const v of ventas) {
    const m = v.paymentMethod
    const t = Number(v.total)
    porMetodo[m] = porMetodo[m] ?? { count: 0, total: 0 }
    porMetodo[m].count += 1
    porMetodo[m].total += t
    totalVentas += t
    if (m === 'EFECTIVO') efectivoVentas += t
  }

  res.json({
    ...caja,
    fondoInicial: Number(caja.fondoInicial),
    ventas,
    metricas: {
      cantVentas:      ventas.length,
      totalVentas:     Math.round(totalVentas),
      efectivoVentas:  Math.round(efectivoVentas),
      porMetodo:       Object.entries(porMetodo).map(([method, v]) => ({ method, ...v, total: Math.round(v.total) })),
    },
  })
}
