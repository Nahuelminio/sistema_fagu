import { Response } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { AuthRequest } from '../types'
import { broadcastCatalogUpdate } from '../services/sse.service'
import { emitirFactura, ClienteFactura } from '../services/arca.service'
import { enviarFacturaEmail } from '../services/email.service'

const PAYMENT_METHODS = ['EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'MERCADOPAGO', 'CUENTA_CORRIENTE'] as const

const ventaSchema = z.object({
  items: z
    .array(
      z.union([
        z.object({ productId: z.number().int().positive(), quantity: z.number().positive() }),
        z.object({ tragoId: z.number().int().positive(), quantity: z.number().positive() }),
      ])
    )
    .min(1),
  paymentMethod: z.enum(PAYMENT_METHODS).default('EFECTIVO'),
  discount: z.number().min(0).default(0),
  notes: z.string().optional(),
  generarFactura: z.boolean().optional(),
  clienteId: z.number().int().positive().optional(),
})

export async function createVenta(req: AuthRequest, res: Response): Promise<void> {
  const parsed = ventaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() })
    return
  }

  const { items, paymentMethod, discount, notes, generarFactura, clienteId } = parsed.data

  // No-efectivo → factura obligatoria. Efectivo → solo si el usuario lo pide.
  const debeFacturar = paymentMethod !== 'EFECTIVO' || generarFactura === true

  // Separar ítems por tipo
  const productItems = items.filter((i): i is { productId: number; quantity: number } => 'productId' in i)
  const tragoItems   = items.filter((i): i is { tragoId: number; quantity: number }   => 'tragoId'   in i)

  // Cargar productos directos
  const products = productItems.length
    ? await prisma.product.findMany({ where: { id: { in: productItems.map((i) => i.productId) } } })
    : []

  // Cargar tragos con sus ingredientes
  const tragos = tragoItems.length
    ? await prisma.trago.findMany({
        where: { id: { in: tragoItems.map((i) => i.tragoId) } },
        include: { ingredientes: { include: { product: true } } },
      })
    : []

  // Validar que todos existan
  if (products.length !== productItems.length) {
    res.status(404).json({ error: 'Uno o más productos no encontrados' })
    return
  }
  if (tragos.length !== tragoItems.length) {
    res.status(404).json({ error: 'Uno o más tragos no encontrados' })
    return
  }

  // ── Validar stock de productos directos ──────────────────────────────────
  for (const item of productItems) {
    const product = products.find((p) => p.id === item.productId)!
    if (Number(product.currentStock) < item.quantity) {
      res.status(400).json({
        error: `Stock insuficiente para "${product.name}"`,
        available: product.currentStock,
      })
      return
    }
  }

  // ── Acumular requerimientos por ingrediente de tragos ────────────────────
  const stockRequerido = new Map<number, number>()
  for (const item of tragoItems) {
    const trago = tragos.find((t) => t.id === item.tragoId)!
    for (const ing of trago.ingredientes) {
      const prev = stockRequerido.get(ing.productId) ?? 0
      stockRequerido.set(ing.productId, prev + Number(ing.cantidad) * item.quantity)
    }
  }

  // ── Cargar botellas activas para los ingredientes ────────────────────────
  const ingredientIds = [...stockRequerido.keys()]
  const botellas = ingredientIds.length
    ? await prisma.botellaActiva.findMany({ where: { productId: { in: ingredientIds } } })
    : []
  const botellaMap = new Map(botellas.map((b) => [b.productId, b]))

  // ── Validar disponibilidad por ingrediente ───────────────────────────────
  // Con botella activa → verificar restante
  // Sin botella activa → verificar currentStock
  const sinBotella = ingredientIds.filter((id) => !botellaMap.has(id))
  const productsSinBotella = sinBotella.length
    ? await prisma.product.findMany({ where: { id: { in: sinBotella } } })
    : []

  for (const [productId, requerido] of stockRequerido.entries()) {
    const botella = botellaMap.get(productId)
    if (botella) {
      if (Number(botella.restante) < requerido) {
        const p = productsSinBotella.find((p) => p.id === productId)
          ?? tragos.flatMap((t) => t.ingredientes).find((i) => i.productId === productId)?.product
        res.status(400).json({
          error: `Botella insuficiente para "${p?.name ?? 'ingrediente'}" (quedan ${Number(botella.restante).toFixed(1)} oz, se necesitan ${requerido} oz)`,
          available: botella.restante,
          required: requerido,
        })
        return
      }
    } else {
      const product = productsSinBotella.find((p) => p.id === productId)
      if (!product || Number(product.currentStock) < requerido) {
        res.status(400).json({
          error: `Stock insuficiente para "${product?.name ?? 'ingrediente'}"`,
          available: product?.currentStock ?? 0,
          required: requerido,
        })
        return
      }
    }
  }

  // ── Calcular total ────────────────────────────────────────────────────────
  const totalProductos = productItems.reduce((sum, item) => {
    const p = products.find((p) => p.id === item.productId)!
    return sum + Number(p.salePrice ?? 0) * item.quantity
  }, 0)
  const totalTragos = tragoItems.reduce((sum, item) => {
    const t = tragos.find((t) => t.id === item.tragoId)!
    return sum + Number(t.salePrice ?? 0) * item.quantity
  }, 0)
  const subtotal = totalProductos + totalTragos
  const total    = Math.max(0, subtotal - discount)

  const sale = await prisma.$transaction(
    async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          userId: req.user!.userId,
          clienteId: clienteId ?? null,
          subtotal,
          discount,
          total,
          paymentMethod,
          notes,
          items: {
            create: [
              ...productItems.map((item) => {
                const p = products.find((p) => p.id === item.productId)!
                return {
                  productId: item.productId,
                  nombre: p.name,
                  quantity: item.quantity,
                  unitPrice: Number(p.salePrice ?? 0),
                }
              }),
              ...tragoItems.map((item) => {
                const t = tragos.find((t) => t.id === item.tragoId)!
                return {
                  tragoId: item.tragoId,
                  nombre: t.name,
                  quantity: item.quantity,
                  unitPrice: Number(t.salePrice ?? 0),
                }
              }),
            ],
          },
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, unit: true } },
              trago: { select: { id: true, name: true } },
            },
          },
          user: { select: { id: true, name: true } },
        },
      })

      // ── Productos directos: SALIDA de stock ──────────────────────────────
      const productOps = productItems.flatMap((item) => [
        tx.stockMovement.create({
          data: {
            productId: item.productId,
            userId: req.user!.userId,
            type: 'SALIDA',
            quantity: item.quantity,
            notes: `Venta #${newSale.id}`,
          },
        }),
        tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.quantity } },
        }),
      ])

      // ── Ingredientes de tragos ────────────────────────────────────────────
      // Con botella activa  → solo descuenta restante (stock ya salió al abrir la botella)
      // Sin botella activa  → descuenta stock + movimiento SALIDA
      const tragoOps: Promise<unknown>[] = []

      for (const [productId, cantTotal] of stockRequerido.entries()) {
        const botella = botellaMap.get(productId)
        if (botella) {
          // Solo descuenta de la botella activa
          tragoOps.push(
            tx.botellaActiva.update({
              where: { id: botella.id },
              data: { restante: { decrement: cantTotal } },
            })
          )
        } else {
          // Sin botella: descuenta stock + movimiento
          const ingName = tragos
            .flatMap((t) => t.ingredientes)
            .find((i) => i.productId === productId)?.product.name ?? 'ingrediente'
          tragoOps.push(
            tx.stockMovement.create({
              data: {
                productId,
                userId: req.user!.userId,
                type: 'SALIDA',
                quantity: cantTotal,
                notes: `Venta #${newSale.id} — ${ingName}`,
              },
            }),
            tx.product.update({
              where: { id: productId },
              data: { currentStock: { decrement: cantTotal } },
            })
          )
        }
      }

      // Normalizar restante a 0 si quedó negativo (borde)
      await Promise.all([...productOps, ...tragoOps])
      await tx.botellaActiva.updateMany({
        where: { restante: { lt: 0 } },
        data:  { restante: 0 },
      })

      return newSale
    },
    { timeout: 20000 }
  )

  // Facturación electrónica ARCA + envío de email
  try {
    let clienteData: (ClienteFactura & { email?: string | null }) | null = null
    if (clienteId) {
      const c = await prisma.cliente.findUnique({
        where: { id: clienteId },
        select: { nombre: true, cuit: true, dni: true, email: true },
      })
      clienteData = c ?? null
    }

    const factura = debeFacturar ? await emitirFactura(total, clienteData) : null
    if (factura) {
      await prisma.sale.update({
        where: { id: sale.id },
        data: {
          cae:            factura.cae,
          caeVencimiento: factura.caeVencimiento,
          nroFactura:     factura.nroFactura,
          puntoVenta:     factura.puntoVenta,
        },
      })
      ;(sale as any).cae        = factura.cae
      ;(sale as any).nroFactura = factura.nroFactura
    }

    // Enviar factura por email si el cliente tiene email
    if (clienteData?.email && (factura || debeFacturar)) {
      await enviarFacturaEmail({
        clienteNombre: clienteData.nombre,
        clienteEmail:  clienteData.email,
        saleId:        sale.id,
        total,
        items: sale.items.map((i) => ({
          nombre:    i.nombre || (i as any).product?.name || (i as any).trago?.name || '?',
          quantity:  Number(i.quantity),
          unitPrice: Number(i.unitPrice),
        })),
        paymentMethod: paymentMethod,
        cae:           factura?.cae ?? null,
        nroFactura:    factura?.nroFactura ?? null,
        fecha:         new Date(),
      })
    }
  } catch (err) {
    console.error('[ARCA/Email] Error:', err)
  }

  broadcastCatalogUpdate()
  res.status(201).json(sale)
}

export async function getRanking(req: AuthRequest, res: Response): Promise<void> {
  const { from, to } = req.query
  const where: Record<string, unknown> = {}
  if (from || to) {
    where.sale = {
      createdAt: {
        ...(from ? { gte: new Date(from as string) } : {}),
        ...(to   ? { lte: new Date(to   as string) } : {}),
      },
    }
  }

  // Agrupar SaleItems
  const items = await prisma.saleItem.findMany({
    where,
    select: { tragoId: true, productId: true, nombre: true, quantity: true, unitPrice: true },
  })

  // Acumular por tragoId/productId
  const map = new Map<string, { nombre: string; tragoId: number | null; productId: number | null; qty: number; revenue: number }>()
  for (const item of items) {
    const key = item.tragoId ? `t_${item.tragoId}` : `p_${item.productId}`
    const prev = map.get(key)
    if (prev) {
      prev.qty     += Number(item.quantity)
      prev.revenue += Number(item.quantity) * Number(item.unitPrice)
    } else {
      map.set(key, {
        nombre:    item.nombre || '',
        tragoId:   item.tragoId,
        productId: item.productId,
        qty:       Number(item.quantity),
        revenue:   Number(item.quantity) * Number(item.unitPrice),
      })
    }
  }

  // Filtrar entradas sin tragoId ni productId (datos corruptos)
  for (const [key, val] of map.entries()) {
    if (!val.tragoId && !val.productId) map.delete(key)
  }

  // Obtener costos
  const tragoIds   = [...map.values()].filter((v) => v.tragoId).map((v) => v.tragoId!)
  const productIds = [...map.values()].filter((v) => v.productId).map((v) => v.productId!)

  const [tragos, products] = await Promise.all([
    tragoIds.length
      ? prisma.trago.findMany({
          where: { id: { in: tragoIds } },
          include: {
            ingredientes: {
              include: {
                product: {
                  select: {
                    id: true, costPrice: true,
                    botellaActiva: { select: { capacidad: true } },
                  },
                },
              },
            },
          },
        })
      : [],
    productIds.length
      ? prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, costPrice: true } })
      : [],
  ])

  const tragoMap   = new Map(tragos.map((t) => [t.id, t]))
  const productMap = new Map(products.map((p) => [p.id, p]))

  const ranking = [...map.values()].map((entry) => {
    let cost = 0
    if (entry.tragoId) {
      const t = tragoMap.get(entry.tragoId)
      if (t) {
        cost = t.ingredientes.reduce((sum, ing) => {
          const precio    = Number(ing.product.costPrice ?? 0)
          const capacidad = Number(ing.product.botellaActiva?.capacidad ?? 0)
          const ozCost    = capacidad > 0 ? precio / capacidad : 0
          return sum + Number(ing.cantidad) * ozCost
        }, 0)
      }
    } else if (entry.productId) {
      const p = productMap.get(entry.productId)
      cost = Number(p?.costPrice ?? 0)
    }

    const totalCost = cost * entry.qty
    const margin    = entry.revenue - totalCost
    const marginPct = entry.revenue > 0 ? (margin / entry.revenue) * 100 : 0

    // Fallback de nombre desde la entidad si el SaleItem es antiguo (nombre vacío)
    const fallbackNombre = entry.nombre ||
      (entry.tragoId   ? (tragoMap.get(entry.tragoId)?.name   ?? `Trago #${entry.tragoId}`)   : '') ||
      (entry.productId ? (productMap.get(entry.productId) as { name?: string } | undefined)?.name ?? `Producto #${entry.productId}` : '')

    return {
      nombre:    fallbackNombre,
      tragoId:   entry.tragoId,
      productId: entry.productId,
      qty:       entry.qty,
      revenue:   Math.round(entry.revenue),
      cost:      Math.round(totalCost * 100) / 100,
      margin:    Math.round(margin),
      marginPct: Math.round(marginPct),
    }
  })

  ranking.sort((a, b) => b.revenue - a.revenue)
  res.json(ranking)
}

export async function getVentas(req: AuthRequest, res: Response): Promise<void> {
  const { from, to, page = '1', limit = '50' } = req.query

  const where: Record<string, unknown> = {}
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from as string) } : {}),
      ...(to ? { lte: new Date(to as string) } : {}),
    }
  }

  const pageNum  = Math.max(1, parseInt(page as string) || 1)
  const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50))

  const [ventas, total] = await prisma.$transaction([
    prisma.sale.findMany({
      where,
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, unit: true } },
            trago: { select: { id: true, name: true } },
          },
        },
        user: { select: { id: true, name: true } },
        cliente: { select: { id: true, nombre: true, cuit: true, dni: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.sale.count({ where }),
  ])

  const totalRevenue = ventas.reduce((sum, v) => sum + Number(v.total), 0)

  res.json({ ventas, total, page: pageNum, pages: Math.ceil(total / limitNum), totalRevenue })
}

export async function exportVentasCSV(req: AuthRequest, res: Response): Promise<void> {
  const { from, to } = req.query
  const where: Record<string, unknown> = {}
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from as string) } : {}),
      ...(to   ? { lte: new Date(to   as string) } : {}),
    }
  }

  const ventas = await prisma.sale.findMany({
    where,
    include: {
      items: {
        include: {
          product: { select: { name: true, unit: true } },
          trago:   { select: { name: true } },
        },
      },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows: string[] = [
    'Fecha,ID,Usuario,Metodo Pago,Items,Subtotal,Descuento,Total,CAE'
  ]

  for (const v of ventas) {
    const items = v.items.map((i) => {
      const nombre = i.nombre || i.product?.name || i.trago?.name || '?'
      return `${nombre} x${Number(i.quantity)}`
    }).join(' | ')

    rows.push([
      new Date(v.createdAt).toLocaleString('es-AR'),
      v.id,
      v.user.name,
      v.paymentMethod,
      `"${items}"`,
      Number(v.subtotal),
      Number(v.discount),
      Number(v.total),
      v.cae ?? '',
    ].join(','))
  }

  const csv = rows.join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="ventas-${Date.now()}.csv"`)
  res.send('﻿' + csv) // BOM para Excel
}
