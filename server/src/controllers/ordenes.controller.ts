import { Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'

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
  const orden = await prisma.ordenCompra.create({
    data: {
      userId: req.user!.userId,
      proveedorId: proveedorId ?? null,
      notes,
      items: {
        create: items.map((i) => ({
          productId: i.productId,
          quantity:  i.quantity,
          unitCost:  i.unitCost,
        })),
      },
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

  await prisma.$transaction(async (tx) => {
    for (const item of orden.items) {
      const qty = received ? (received[String(item.id)] ?? Number(item.quantity)) : Number(item.quantity)
      if (qty <= 0) continue

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          userId: req.user!.userId,
          type: 'INGRESO',
          quantity: qty,
          unitCost: item.unitCost,
          notes: `Orden de compra #${orden.id}`,
        },
      })
      await tx.product.update({
        where: { id: item.productId },
        data: { currentStock: { increment: qty } },
      })
      await tx.ordenItem.update({
        where: { id: item.id },
        data: { received: qty },
      })
    }

    await tx.ordenCompra.update({
      where: { id },
      data: { status: 'RECIBIDA' },
    })
  }, { timeout: 20000 })

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
