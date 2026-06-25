import { Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'
import { calcularCostoPromedioPonderado } from '../utils/weightedAverageCost'

// ── Proveedores ───────────────────────────────────────────────────────────────

export async function getProveedores(_req: AuthRequest, res: Response): Promise<void> {
  const proveedores = await prisma.proveedor.findMany({ orderBy: { name: 'asc' } })
  res.json(proveedores)
}

export async function createProveedor(req: AuthRequest, res: Response): Promise<void> {
  const { name, phone, email, notes } = z.object({
    name:  z.string().min(1),
    phone: z.string().optional(),
    email: z.string().optional(),
    notes: z.string().optional(),
  }).parse(req.body)
  const proveedor = await prisma.proveedor.create({ data: { name, phone, email, notes } })
  res.status(201).json(proveedor)
}

export async function updateProveedor(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  const data = z.object({
    name:  z.string().min(1).optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    notes: z.string().optional(),
  }).parse(req.body)
  const proveedor = await prisma.proveedor.update({ where: { id }, data })
  res.json(proveedor)
}

export async function deleteProveedor(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  await prisma.proveedor.delete({ where: { id } })
  res.json({ ok: true })
}

// ── Órdenes de compra ─────────────────────────────────────────────────────────

const ordenItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity:  z.number().positive(),
  unitCost:  z.number().positive().optional(),
})

const createOrdenSchema = z.object({
  proveedorId: z.number().int().positive().optional(),
  notes:       z.string().optional(),
  items:       z.array(ordenItemSchema).min(1),
})

export async function getOrdenes(req: AuthRequest, res: Response): Promise<void> {
  const { status } = req.query
  const where: Record<string, unknown> = {}
  if (status) where.status = status

  const ordenes = await prisma.ordenCompra.findMany({
    where,
    include: {
      proveedor: true,
      items: { include: { product: { select: { id: true, name: true, unit: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(ordenes)
}

export async function getOrden(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  const orden = await prisma.ordenCompra.findUnique({
    where: { id },
    include: {
      proveedor: true,
      items: { include: { product: { select: { id: true, name: true, unit: true } } } },
    },
  })
  if (!orden) { res.status(404).json({ error: 'Orden no encontrada' }); return }
  res.json(orden)
}

export async function createOrden(req: AuthRequest, res: Response): Promise<void> {
  const parsed = createOrdenSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() }); return }

  const { proveedorId, notes, items } = parsed.data

  // Para los ítems sin unitCost, usar el costPrice actual del producto.
  // Así la orden queda con el costo "vigente" en ese momento — útil cuando
  // se cargan compras repetidas sin volver a escribir el costo.
  const productIds = [...new Set(items.map((i) => i.productId))]
  const productos = await prisma.product.findMany({
    where:  { id: { in: productIds } },
    select: { id: true, costPrice: true },
  })
  const costoPorProducto = new Map(productos.map((p) => [p.id, p.costPrice]))

  const itemsConCosto = items.map((i) => {
    let unitCost = i.unitCost
    if (unitCost == null) {
      const costoProducto = costoPorProducto.get(i.productId)
      if (costoProducto != null) unitCost = Number(costoProducto)
    }
    return {
      productId: i.productId,
      quantity:  i.quantity,
      unitCost,
    }
  })

  const orden = await prisma.ordenCompra.create({
    data: {
      userId: req.user!.userId,
      proveedorId: proveedorId ?? null,
      notes,
      items: { create: itemsConCosto },
    },
    include: {
      proveedor: true,
      items: { include: { product: { select: { id: true, name: true, unit: true } } } },
    },
  })
  res.status(201).json(orden)
}

// ── Recibir orden (marca como RECIBIDA y crea movimientos INGRESO) ─────────────

export async function recibirOrden(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)

  const orden = await prisma.ordenCompra.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!orden) { res.status(404).json({ error: 'Orden no encontrada' }); return }
  if (orden.status !== 'PENDIENTE') { res.status(400).json({ error: 'La orden ya fue procesada' }); return }

  // Cantidades recibidas (puede ser parcial)
  const received = z.record(z.string(), z.number().positive()).optional().parse(req.body.received)

  // ── Pre-fetch FUERA de la transacción para minimizar roundtrips dentro ──
  // Para órdenes con muchos items (20+), hacer findUnique adentro de la
  // transacción puede colgarse en el timeout por la latencia acumulada.
  const productIds = [...new Set(orden.items.map((i) => i.productId))]
  const productosCache = await prisma.product.findMany({
    where:  { id: { in: productIds } },
    select: { id: true, currentStock: true, costPrice: true },
  })
  const productoPorId = new Map(productosCache.map((p) => [p.id, p]))

  // Precomputar todo el plan de cambios antes de abrir la transacción
  interface Plan {
    itemId: number
    productId: number
    qty: number
    nuevoCosto: number | null
    unitCost: number | null
  }
  const plan: Plan[] = []
  for (const item of orden.items) {
    const qty = received ? (received[String(item.id)] ?? Number(item.quantity)) : Number(item.quantity)
    if (qty <= 0) continue
    const product = productoPorId.get(item.productId)
    if (!product) continue
    const nuevoCosto = calcularCostoPromedioPonderado({
      stockActual:   Number(product.currentStock),
      costoActual:   product.costPrice == null ? null : Number(product.costPrice),
      cantidadNueva: qty,
      costoNuevo:    item.unitCost == null ? null : Number(item.unitCost),
    })
    plan.push({
      itemId: item.id,
      productId: item.productId,
      qty,
      nuevoCosto,
      unitCost: item.unitCost == null ? null : Number(item.unitCost),
    })
  }

  // Estrategia anti-timeout: NO usar una transacción gigante.
  // Con muchos items (20+) y latencia de Railway desde local, la transacción
  // se cuelga y el proxy cierra la conexión a mitad. Las operaciones son
  // idempotentes por item: si ya recibimos quantity, lo salteamos en retry.
  //
  // 1) Insertar todos los movimientos en bulk (1 roundtrip).
  if (plan.length > 0) {
    await prisma.stockMovement.createMany({
      data: plan.map((p) => ({
        productId: p.productId,
        userId: req.user!.userId,
        type: 'INGRESO' as const,
        quantity: p.qty,
        unitCost: p.unitCost,
        notes: `Orden de compra #${orden.id}`,
      })),
    })
  }

  // 2) Actualizar productos y items de la orden (uno a uno, sin transacción
  //    larga). Si la conexión se cae a la mitad, la orden queda en PENDIENTE
  //    y los items procesados tienen received > 0 — se puede reintentar.
  for (const p of plan) {
    // Idempotencia: si el item ya fue recibido en un intento anterior, saltar
    const itemActual = await prisma.ordenItem.findUnique({
      where: { id: p.itemId },
      select: { received: true },
    })
    if (itemActual && Number(itemActual.received) >= p.qty) continue

    await prisma.product.update({
      where: { id: p.productId },
      data: {
        currentStock: { increment: p.qty },
        ...(p.nuevoCosto != null ? { costPrice: p.nuevoCosto } : {}),
      },
    })
    await prisma.ordenItem.update({
      where: { id: p.itemId },
      data: { received: p.qty },
    })
  }

  // 3) Marcar la orden como recibida sólo si todo terminó OK
  await prisma.ordenCompra.update({
    where: { id },
    data: { status: 'RECIBIDA' },
  })

  res.json({ ok: true })
}

export async function cancelarOrden(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(req.params.id)
  if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return }

  const orden = await prisma.ordenCompra.findUnique({ where: { id } })
  if (!orden) { res.status(404).json({ error: 'Orden no encontrada' }); return }
  if (orden.status !== 'PENDIENTE') {
    res.status(400).json({ error: 'Solo se pueden cancelar órdenes pendientes' }); return
  }

  await prisma.ordenCompra.update({ where: { id }, data: { status: 'CANCELADA' } })
  res.json({ ok: true })
}
