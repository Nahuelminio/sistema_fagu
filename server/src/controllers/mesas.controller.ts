import { Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'
import { processFacturaYEmail } from '../utils/processFactura'

const PAYMENT_METHODS = ['EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'MERCADOPAGO', 'CUENTA_CORRIENTE'] as const

class StockError extends Error {
  constructor(msg: string) { super(msg); this.name = 'StockError' }
}

// ── Mesas ────────────────────────────────────────────────────────────────────

export async function getMesas(_req: AuthRequest, res: Response): Promise<void> {
  const mesas = await prisma.mesa.findMany({
    include: {
      comandas: {
        where: { status: 'ABIERTA' },
        include: { items: true },
      },
    },
    orderBy: { numero: 'asc' },
  })
  res.json(mesas)
}

export async function createMesa(req: AuthRequest, res: Response): Promise<void> {
  const parsed = z.object({
    numero: z.number().int().positive(),
    nombre: z.string().optional(),
  }).safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return }

  try {
    const mesa = await prisma.mesa.create({ data: parsed.data })
    res.status(201).json(mesa)
  } catch (e: any) {
    if (e.code === 'P2002') { res.status(400).json({ error: `Ya existe una mesa con el número ${parsed.data.numero}` }); return }
    throw e
  }
}

export async function deleteMesa(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return }

  // Solo bloquea si hay una comanda abierta CON items (pedidos sin cobrar).
  // Una comanda abierta vacía no es problema — se borra junto con la mesa.
  const openComanda = await prisma.comanda.findFirst({
    where: { mesaId: id, status: 'ABIERTA' },
    include: { _count: { select: { items: true } } },
  })
  if (openComanda && openComanda._count.items > 0) {
    res.status(400).json({ error: 'No se puede eliminar: la cuenta tiene pedidos sin cobrar. Cobrala o sacá los ítems primero.' }); return
  }

  try {
    // Cascade manual: borrar comandas históricas (CERRADAS) + sus items.
    // Las ventas (Sale) quedan intactas porque son entidades independientes
    // que ya tienen todos los datos copiados.
    await prisma.$transaction(async (tx) => {
      const comandas = await tx.comanda.findMany({ where: { mesaId: id }, select: { id: true } })
      const comandaIds = comandas.map((c) => c.id)
      if (comandaIds.length > 0) {
        await tx.comandaItem.deleteMany({ where: { comandaId: { in: comandaIds } } })
        await tx.comanda.deleteMany({ where: { id: { in: comandaIds } } })
      }
      await tx.mesa.delete({ where: { id } })
    })
    res.json({ ok: true })
  } catch (e: any) {
    if (e.code === 'P2025') { res.status(404).json({ error: 'Cuenta no encontrada' }); return }
    throw e
  }
}

// ── Comandas ─────────────────────────────────────────────────────────────────

const addItemSchema = z.object({
  type: z.enum(['product', 'trago']),
  id: z.number().int().positive(),
  quantity: z.number().positive(),
})

export async function getComanda(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  const comanda = await prisma.comanda.findUnique({
    where: { id },
    include: { items: true, mesa: true },
  })
  if (!comanda) { res.status(404).json({ error: 'Comanda no encontrada' }); return }
  res.json(comanda)
}

export async function openComanda(req: AuthRequest, res: Response): Promise<void> {
  const mesaId = parseInt(req.params.mesaId)
  if (isNaN(mesaId)) { res.status(400).json({ error: 'ID de mesa inválido' }); return }
  const notes  = (req.body.notes as string) ?? undefined

  const mesa = await prisma.mesa.findUnique({ where: { id: mesaId } })
  if (!mesa) { res.status(404).json({ error: 'Mesa no encontrada' }); return }

  // Evitar abrir múltiples comandas ABIERTAS sobre la misma mesa
  const existente = await prisma.comanda.findFirst({ where: { mesaId, status: 'ABIERTA' } })
  if (existente) {
    res.status(400).json({ error: 'La mesa ya tiene una cuenta abierta', comandaId: existente.id })
    return
  }

  const comanda = await prisma.comanda.create({
    data: { mesaId, userId: req.user!.userId, notes },
    include: { items: true, mesa: true },
  })
  res.status(201).json(comanda)
}

export async function addItemToComanda(req: AuthRequest, res: Response): Promise<void> {
  const comandaId = parseInt(req.params.id)
  if (isNaN(comandaId)) { res.status(400).json({ error: 'ID de comanda inválido' }); return }
  const parsed = addItemSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return }

  const { type, id, quantity } = parsed.data

  const comanda = await prisma.comanda.findUnique({ where: { id: comandaId } })
  if (!comanda || comanda.status !== 'ABIERTA') {
    res.status(400).json({ error: 'Comanda no disponible' }); return
  }

  if (type === 'product') {
    const p = await prisma.product.findUnique({ where: { id } })
    if (!p) { res.status(404).json({ error: 'Producto no encontrado' }); return }
    // Aviso temprano si no hay stock — el descuento real se hace al cerrar la comanda
    if (Number(p.currentStock) < quantity) {
      res.status(400).json({ error: `Stock insuficiente para "${p.name}" (disponible: ${p.currentStock})` })
      return
    }
    await prisma.comandaItem.create({
      data: { comandaId, productId: id, nombre: p.name, quantity, unitPrice: Number(p.salePrice ?? 0) },
    })
  } else {
    const t = await prisma.trago.findUnique({ where: { id } })
    if (!t) { res.status(404).json({ error: 'Trago no encontrado' }); return }
    await prisma.comandaItem.create({
      data: { comandaId, tragoId: id, nombre: t.name, quantity, unitPrice: Number(t.salePrice ?? 0) },
    })
  }

  const updated = await prisma.comanda.findUnique({
    where: { id: comandaId },
    include: { items: true, mesa: true },
  })
  res.json(updated)
}

export async function removeItemFromComanda(req: AuthRequest, res: Response): Promise<void> {
  const itemId    = parseInt(req.params.itemId)
  const comandaId = parseInt(req.params.id)
  if (isNaN(itemId) || isNaN(comandaId)) { res.status(400).json({ error: 'ID inválido' }); return }

  const item = await prisma.comandaItem.findUnique({
    where: { id: itemId },
    include: { comanda: true },
  })
  if (!item || item.comandaId !== comandaId) {
    res.status(404).json({ error: 'Ítem no encontrado' }); return
  }
  if (item.comanda.status !== 'ABIERTA') {
    res.status(400).json({ error: 'La comanda ya está cerrada' }); return
  }

  await prisma.comandaItem.delete({ where: { id: itemId } })
  res.json({ ok: true })
}

// ── Cerrar comanda → crear venta ─────────────────────────────────────────────

const cerrarSchema = z.object({
  paymentMethod:   z.enum(PAYMENT_METHODS).default('EFECTIVO'),
  discount:        z.number().min(0).default(0),
  notes:           z.string().optional(),
  generarFactura:  z.boolean().optional(),
  clienteId:       z.number().int().positive().optional(),
})

export async function cerrarComanda(req: AuthRequest, res: Response): Promise<void> {
  const comandaId = parseInt(req.params.id)
  const parsed = cerrarSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return }

  const { paymentMethod, discount, notes: saleNotes, generarFactura, clienteId } = parsed.data

  // No-efectivo → factura obligatoria. Efectivo → solo si el usuario lo pide.
  const debeFacturar = paymentMethod !== 'EFECTIVO' || generarFactura === true

  const comanda = await prisma.comanda.findUnique({
    where: { id: comandaId },
    include: {
      items: true,
      mesa: true,
    },
  })

  if (!comanda || comanda.status !== 'ABIERTA') {
    res.status(400).json({ error: 'Comanda no disponible' }); return
  }
  if (comanda.items.length === 0) {
    res.status(400).json({ error: 'La comanda está vacía' }); return
  }

  const subtotal = comanda.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0)
  const total    = Math.max(0, subtotal - discount)

  // ── Validar stock antes de ejecutar ────────────────────────────────────
  const productItems = comanda.items.filter((i) => i.productId)
  const tragoItems   = comanda.items.filter((i) => i.tragoId)

  // Validar productos directos
  const directProducts = productItems.length
    ? await prisma.product.findMany({ where: { id: { in: productItems.map((i) => i.productId!) } } })
    : []

  for (const item of productItems) {
    const p = directProducts.find((p) => p.id === item.productId)!
    if (Number(p.currentStock) < Number(item.quantity)) {
      res.status(400).json({ error: `Stock insuficiente para "${p.name}"`, available: p.currentStock })
      return
    }
  }

  // Validar ingredientes de tragos (con soporte de grupos de variantes)
  const tragoIds = [...new Set(tragoItems.map((i) => i.tragoId!))]
  const tragos = tragoIds.length
    ? await prisma.trago.findMany({
        where: { id: { in: tragoIds } },
        include: {
          ingredientes: {
            include: {
              product: {
                include: { grupo: { include: { products: { select: { id: true, name: true } } } } },
              },
            },
          },
        },
      })
    : []

  // Acumular requerimientos por ingrediente (clave por grupo o producto)
  interface IngredienteReq { oz: number; candidatos: number[]; nombre: string }
  const reqPorKey = new Map<string, IngredienteReq>()
  for (const item of tragoItems) {
    const t = tragos.find((t) => t.id === item.tragoId)!
    for (const ing of t.ingredientes) {
      const p   = ing.product
      const key = p.grupoId ? `g:${p.grupoId}` : `p:${p.id}`
      const oz  = Number(ing.cantidad) * Number(item.quantity)
      const existing = reqPorKey.get(key)
      if (existing) {
        existing.oz += oz
      } else {
        const candidatos = p.grupoId && p.grupo
          ? p.grupo.products.map((gp) => gp.id)
          : [p.id]
        reqPorKey.set(key, { oz, candidatos, nombre: p.grupo?.name ?? p.name })
      }
    }
  }

  const allCandidatos = [...new Set([...reqPorKey.values()].flatMap((r) => r.candidatos))]
  const botellas = allCandidatos.length
    ? await prisma.botellaActiva.findMany({ where: { productId: { in: allCandidatos } } })
    : []
  const candidatosProducts = allCandidatos.length
    ? await prisma.product.findMany({ where: { id: { in: allCandidatos } } })
    : []

  interface ConsumoTrago { botellaId: number | null; productId: number; oz: number; nombre: string }
  const consumos: ConsumoTrago[] = []

  for (const [, req2] of reqPorKey) {
    const botella = botellas.find((b) => req2.candidatos.includes(b.productId))
    if (botella) {
      if (Number(botella.restante) < req2.oz) {
        res.status(400).json({ error: `Botella insuficiente para "${req2.nombre}" (quedan ${Number(botella.restante).toFixed(1)} oz)` })
        return
      }
      consumos.push({ botellaId: botella.id, productId: botella.productId, oz: req2.oz, nombre: req2.nombre })
    } else {
      const candProds = candidatosProducts.filter((p) => req2.candidatos.includes(p.id))
      const esBotella = candProds.some((p) => p.bottleSize)
      if (esBotella) {
        const hayStock = candProds.some((p) => Number(p.currentStock) >= 1)
        res.status(400).json({
          error: hayStock
            ? `Tenés que abrir una botella de "${req2.nombre}" antes de vender este trago`
            : `No hay stock de "${req2.nombre}"`,
        })
        return
      }
      const prod = candProds[0]
      if (!prod || Number(prod.currentStock) < req2.oz) {
        res.status(400).json({ error: `Stock insuficiente para "${req2.nombre}"` })
        return
      }
      consumos.push({ botellaId: null, productId: prod.id, oz: req2.oz, nombre: req2.nombre })
    }
  }

  // Buscar caja abierta para asociar la venta
  const cajaAbierta = await prisma.caja.findFirst({
    where:  { status: 'ABIERTA' },
    select: { id: true },
  })

  // Importar la lógica de createVenta sería complejo; llamamos directamente con prisma
  // Crear la venta y cerrar la comanda en una transacción
  let sale
  try {
    sale = await prisma.$transaction(async (tx) => {
    const newSale = await tx.sale.create({
      data: {
        userId: req.user!.userId,
        ...(clienteId ? { clienteId } : {}),
        ...(cajaAbierta ? { cajaId: cajaAbierta.id } : {}),
        subtotal,
        discount,
        total,
        paymentMethod,
        notes: saleNotes ?? `Mesa ${comanda.mesa.numero}`,
        items: {
          create: comanda.items.map((i) => ({
            ...(i.productId ? { productId: i.productId } : {}),
            ...(i.tragoId   ? { tragoId:   i.tragoId   } : {}),
            nombre:    i.nombre,
            quantity:  i.quantity,
            unitPrice: i.unitPrice,
          })),
        },
      },
    })

    // Descontar stock para productos directos (atómico con guard)
    for (const item of comanda.items.filter((i) => i.productId)) {
      const qty = Number(item.quantity)
      const upd = await tx.product.updateMany({
        where: { id: item.productId!, currentStock: { gte: qty } },
        data:  { currentStock: { decrement: qty } },
      })
      if (upd.count === 0) {
        throw new StockError(`Stock insuficiente para "${item.nombre}" (otra operación consumió el stock)`)
      }
      await tx.stockMovement.create({
        data: {
          productId: item.productId!,
          userId: req.user!.userId,
          type: 'SALIDA',
          quantity: qty,
          notes: `Venta #${newSale.id} (Mesa ${comanda.mesa.numero})`,
        },
      })
    }

    // Descontar oz para tragos — usa los `consumos` ya resueltos arriba (atómico)
    for (const c of consumos) {
      if (c.botellaId) {
        const upd = await tx.botellaActiva.updateMany({
          where: { id: c.botellaId, restante: { gte: c.oz } },
          data:  { restante: { decrement: c.oz } },
        })
        if (upd.count === 0) {
          throw new StockError(`Botella insuficiente para "${c.nombre}" (otra operación consumió el contenido)`)
        }
      } else {
        const upd = await tx.product.updateMany({
          where: { id: c.productId, currentStock: { gte: c.oz } },
          data:  { currentStock: { decrement: c.oz } },
        })
        if (upd.count === 0) {
          throw new StockError(`Stock insuficiente para "${c.nombre}"`)
        }
        await tx.stockMovement.create({
          data: {
            productId: c.productId,
            userId:    req.user!.userId,
            type:      'SALIDA',
            quantity:  c.oz,
            notes:     `Venta #${newSale.id} (Mesa ${comanda.mesa.numero}) — ${c.nombre}`,
          },
        })
      }
    }

    // Cerrar comanda
    await tx.comanda.update({
      where: { id: comandaId },
      data: { status: 'CERRADA' },
    })

    return newSale
  }, { timeout: 20000 })
  } catch (err) {
    if (err instanceof StockError) {
      res.status(409).json({ error: err.message })
      return
    }
    throw err
  }

  // Facturación electrónica ARCA + email (no bloqueante)
  await processFacturaYEmail({
    saleId:        sale.id,
    total,
    paymentMethod,
    clienteId:     clienteId ?? null,
    debeFacturar,
  })

  // Re-leer la venta con el CAE ya actualizado (si se emitió factura)
  const saleFinal = await prisma.sale.findUnique({
    where: { id: sale.id },
    select: { id: true, total: true, cae: true, nroFactura: true, puntoVenta: true },
  })

  res.status(201).json({
    saleId:     sale.id,
    total:      Number(sale.total),
    cae:        saleFinal?.cae ?? null,
    nroFactura: saleFinal?.nroFactura ?? null,
    puntoVenta: saleFinal?.puntoVenta ?? null,
  })
}
