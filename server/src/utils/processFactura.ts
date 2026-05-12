/**
 * Lógica compartida para emitir factura ARCA + enviar email tras una venta.
 *
 * Se llama después de crear el Sale en la DB. Si todo va bien, actualiza
 * el Sale con CAE/nroFactura/etc. y manda el email al cliente.
 *
 * Nunca lanza — los errores se loguean para no romper la venta.
 */

import prisma from '../lib/prisma'
import { emitirFactura, ClienteFactura } from '../services/arca.service'
import { enviarFacturaEmail } from '../services/email.service'

interface ProcessFacturaArgs {
  saleId:        number
  total:         number
  paymentMethod: string
  clienteId?:    number | null
  /** Si el método de pago es no-efectivo, debeFacturar es true. Si es efectivo, depende del usuario. */
  debeFacturar:  boolean
}

export async function processFacturaYEmail(args: ProcessFacturaArgs): Promise<void> {
  const { saleId, total, paymentMethod, clienteId, debeFacturar } = args

  try {
    // Cargar datos del cliente si existe
    let clienteData: (ClienteFactura & { email?: string | null }) | null = null
    if (clienteId) {
      const c = await prisma.cliente.findUnique({
        where: { id: clienteId },
        select: { nombre: true, cuit: true, dni: true, email: true },
      })
      clienteData = c ?? null
    }

    // Emitir factura en ARCA
    const factura = debeFacturar ? await emitirFactura(total, clienteData) : null
    if (factura) {
      await prisma.sale.update({
        where: { id: saleId },
        data: {
          cae:            factura.cae,
          caeVencimiento: factura.caeVencimiento,
          nroFactura:     factura.nroFactura,
          puntoVenta:     factura.puntoVenta,
        },
      })
    }

    // Enviar factura por email si el cliente tiene email cargado
    if (clienteData?.email && (factura || debeFacturar)) {
      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: {
          items: {
            include: {
              product: { select: { name: true } },
              trago:   { select: { name: true } },
            },
          },
        },
      })

      if (sale) {
        await enviarFacturaEmail({
          clienteNombre: clienteData.nombre,
          clienteEmail:  clienteData.email,
          saleId,
          total,
          items: sale.items.map((i) => ({
            nombre:    i.nombre || i.product?.name || i.trago?.name || '?',
            quantity:  Number(i.quantity),
            unitPrice: Number(i.unitPrice),
          })),
          paymentMethod,
          cae:        factura?.cae ?? null,
          nroFactura: factura?.nroFactura ?? null,
          fecha:      new Date(),
        })
      }
    }
  } catch (err) {
    console.error('[ARCA/Email] Error:', err)
  }
}
