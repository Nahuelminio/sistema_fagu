import { Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'

const PAYMENT_METHODS = ['EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'MERCADOPAGO', 'CUENTA_CORRIENTE'] as const

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
  const { numero, nombre } = z.object({
    numero: z.number().int().positive(),
    nombre: z.string().optional(),
  }).parse(req.body)

  const mesa = await prisma.mesa.create({ data: { numero, nombre } })
  res.status(201).json(mesa)
}

export async function deleteMesa(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  await prisma.mesa.delete({ where: { id } })
  res.json({ ok: true })
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
  const notes  = (req.body.notes as string) ?? undefined

  const comanda = await prisma.comanda.create({
    data: { mesaId, userId: req.user!.userId, notes },
    include: { items: true, mesa: true },
  })
  res.status(201).json(comanda)
}

export async function addItemToComanda(req: AuthRequest, res: Response): Promise<void> {
  const comandaId = parseInt(req.params.id)
  const parsed = addItemSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return }

  const { type, id, quantity } = parsed.data

  const comanda = await prisma.comanda.findUnique({ where: { id: comandaId } })
  if (!comanda || comanda.status !== 'ABIERTA') {
    res.status(400).json({ error: 'Comanda no disponible' }); return
  }

  let nombre = ''
  let unitPrice = 0

  if (type === 'product') {
    const p = await prisma.product.findUnique({ where: { id } })
    if (!p) { res.status(404).json({ error: 'Producto no encontrado' }); return }
    nombre    = p.name
    unitPrice = Number(p.salePrice ?? 0)
    await prisma.comandaItem.create({
      data: { comandaId, productId: id, nombre, quantity, unitPrice },
    })
  } else {
    const t = await prisma.trago.findUnique({ where: { id } })
    if (!t) { res.status(404).json({ error: 'Trago no encontrado' }); return }
    nombre    = t.name
    unitPrice = Number(t.salePrice ?? 0)
    await prisma.comandaItem.create({
      data: { comandaId, tragoId: id, nombre, quantity, unitPrice },
    })
  }

  const updated = await prisma.comanda.findUnique({
    where: { id: comandaId },
    include: { items: true, mesa: true },
  })
  res.json(updated)
}

export async function removeItemFromComanda(req: AuthRequest, res: Response): Promise<void> {
  const itemId = parseInt(req.params.itemId)
  await prisma.comandaItem.delete({ where: { id: itemId } })
  res.json({ ok: true })
}

// ── Cerrar comanda → crear venta ─────────────────────────────────────────────

const cerrarSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS).default('EFECTIVO'),
  discount: z.number().min(0).default(0),
  notes: z.string().optional(),
})

export async function cerrarComanda(req: AuthRequest, res: Response): Promise<void> {
  const comandaId = parseInt(req.params.id)
  const parsed = cerrarSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return }

  const { paymentMethod, discount, notes: saleNotes } = parsed.data

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

  // Delegamos al endpoint de ventas internamente (reutilizamos la lógica)
  const ventaItems = comanda.items.map((i) =>
    i.tragoId ? { tragoId: i.tragoId, quantity: Number(i.quantity) }
              : { productId: i.productId!, quantity: Number(i.quantity) }
  )

  // Importar la lógica de createVenta sería complejo; llamamos directamente con prisma
  // Crear la venta y cerrar la comanda en una transacción
  const sale = await prisma.$transaction(async (tx) => {
    const newSale = await tx.sale.create({
      data: {
        userId: req.user!.userId,
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

    // Descontar stock para productos directos
    for (const item of comanda.items.filter((i) => i.productId)) {
      await tx.product.update({
        where: { id: item.productId! },
        data: { currentStock: { decrement: Number(item.quantity) } },
      })
      await tx.stockMovement.create({
        data: {
          productId: item.productId!,
          userId: req.user!.userId,
          type: 'SALIDA',
          quantity: Number(item.quantity),
          notes: `Venta #${newSale.id} (Mesa ${comanda.mesa.numero})`,
        },
      })
    }

    // Descontar oz para tragos
    const tragoItems = comanda.items.filter((i) => i.tragoId)
    if (tragoItems.length > 0) {
      const tragos = await tx.trago.findMany({
        where: { id: { in: tragoItems.map((i) => i.tragoId!) } },
        include: { ingredientes: true },
      })
      const requerido = new Map<number, number>()
      for (const item of tragoItems) {
        const t = tragos.find((t) => t.id === item.tragoId)!
        for (const ing of t.ingredientes) {
          const prev = requerido.get(ing.productId) ?? 0
          requerido.set(ing.productId, prev + Number(ing.cantidad) * Number(item.quantity))
        }
      }
      const botellas = await tx.botellaActiva.findMany({
        where: { productId: { in: [...requerido.keys()] } },
      })
      const botellaMap = new Map(botellas.map((b) => [b.productId, b]))

      for (const [productId, cant] of requerido.entries()) {
        const botella = botellaMap.get(productId)
        if (botella) {
          await tx.botellaActiva.update({
            where: { id: botella.id },
            data: { restante: { decrement: cant } },
          })
        } else {
          await tx.product.update({
            where: { id: productId },
            data: { currentStock: { decrement: cant } },
          })
          await tx.stockMovement.create({
            data: {
              productId,
              userId: req.user!.userId,
              type: 'SALIDA',
              quantity: cant,
              notes: `Venta #${newSale.id} (Mesa ${comanda.mesa.numero})`,
            },
          })
        }
      }
      // Normalizar restante a 0 si quedó negativo
      await tx.botellaActiva.updateMany({
        where: { restante: { lt: 0 } },
        data:  { restante: 0 },
      })
    }

    // Cerrar comanda
    await tx.comanda.update({
      where: { id: comandaId },
      data: { status: 'CERRADA' },
    })

    return newSale
  }, { timeout: 20000 })

  res.status(201).json({ saleId: sale.id, total: Number(sale.total) })
}
