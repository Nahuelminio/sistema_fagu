/**
 * Servicio de email — Resend
 *
 * Para activar:
 * 1. Crear cuenta en resend.com (gratis)
 * 2. Generar API Key en el dashboard
 * 3. Agregar en Railway (o .env):
 *    RESEND_API_KEY=re_xxxxxxxxxxxx
 *    RESEND_FROM=FAGU Drink Bar <facturas@tudominio.com>
 *
 * Nota: Resend requiere un dominio verificado para el campo "from".
 * Mientras desarrollás podés usar onboarding@resend.dev (solo envía a tu propio email).
 */

import { Resend } from 'resend'

const RESEND_ENABLED = !!(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM ?? 'FAGU Drink Bar <onboarding@resend.dev>'

let resend: Resend | null = null
function getResend() {
  if (!RESEND_ENABLED) return null
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY)
  return resend
}

export interface FacturaEmailData {
  clienteNombre: string
  clienteEmail:  string
  saleId:        number
  total:         number
  items:         { nombre: string; quantity: number; unitPrice: number }[]
  paymentMethod: string
  cae?:          string | null
  nroFactura?:   number | null
  fecha:         Date
}

const PAYMENT_LABELS: Record<string, string> = {
  EFECTIVO:        'Efectivo',
  DEBITO:          'Débito',
  CREDITO:         'Crédito',
  TRANSFERENCIA:   'Transferencia',
  MERCADOPAGO:     'MercadoPago',
  CUENTA_CORRIENTE:'Cuenta Corriente',
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function buildHtml(data: FacturaEmailData): string {
  const itemsRows = data.items.map((i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #27272a;font-size:14px;color:#d4d4d8">${i.nombre}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #27272a;font-size:14px;color:#d4d4d8;text-align:center">${Number(i.quantity)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #27272a;font-size:14px;color:#d4d4d8;text-align:right">${formatARS(Number(i.unitPrice))}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #27272a;font-size:14px;color:#a78bfa;text-align:right;font-weight:600">${formatARS(Number(i.unitPrice) * Number(i.quantity))}</td>
    </tr>
  `).join('')

  const fechaStr = data.fecha.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px">
      <h1 style="margin:0;font-size:24px;font-weight:900;letter-spacing:4px;color:#f4f4f5">FAGU</h1>
      <p style="margin:4px 0 0;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#52525b">Drink Bar</p>
    </div>

    <!-- Card -->
    <div style="background:#18181b;border:1px solid #27272a;border-radius:16px;overflow:hidden">

      <!-- Title -->
      <div style="padding:20px 24px;border-bottom:1px solid #27272a">
        <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#71717a">Comprobante de compra</p>
        <h2 style="margin:4px 0 0;font-size:20px;font-weight:700;color:#f4f4f5">
          Factura ${data.nroFactura ? `N° ${String(data.nroFactura).padStart(8, '0')}` : `#${data.saleId}`}
        </h2>
        <p style="margin:4px 0 0;font-size:13px;color:#71717a">${fechaStr}</p>
      </div>

      <!-- Cliente -->
      <div style="padding:16px 24px;border-bottom:1px solid #27272a">
        <p style="margin:0;font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:1px">Cliente</p>
        <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#f4f4f5">${data.clienteNombre}</p>
      </div>

      <!-- Items -->
      <div style="padding:0">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#09090b">
              <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#52525b;text-align:left;text-transform:uppercase;letter-spacing:1px">Item</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#52525b;text-align:center;text-transform:uppercase;letter-spacing:1px">Cant.</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#52525b;text-align:right;text-transform:uppercase;letter-spacing:1px">Precio</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#52525b;text-align:right;text-transform:uppercase;letter-spacing:1px">Subtotal</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
      </div>

      <!-- Total -->
      <div style="padding:16px 24px;border-top:1px solid #27272a;display:flex;justify-content:space-between;align-items:center">
        <div>
          <p style="margin:0;font-size:12px;color:#71717a">Método de pago</p>
          <p style="margin:2px 0 0;font-size:14px;color:#d4d4d8">${PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod}</p>
        </div>
        <div style="text-align:right">
          <p style="margin:0;font-size:12px;color:#71717a">Total</p>
          <p style="margin:2px 0 0;font-size:24px;font-weight:900;color:#a78bfa">${formatARS(data.total)}</p>
        </div>
      </div>

      ${data.cae ? `
      <!-- CAE -->
      <div style="padding:12px 24px;background:#09090b;border-top:1px solid #27272a">
        <p style="margin:0;font-size:11px;color:#52525b;text-transform:uppercase;letter-spacing:1px">CAE — Codigo de Autorizacion Electronico</p>
        <p style="margin:4px 0 0;font-size:13px;font-family:monospace;color:#71717a">${data.cae}</p>
      </div>
      ` : ''}
    </div>

    <!-- Footer -->
    <p style="margin:24px 0 0;text-align:center;font-size:12px;color:#3f3f46">
      Gracias por tu visita — FAGU Drink Bar
    </p>
  </div>
</body>
</html>`
}

export async function enviarFacturaEmail(data: FacturaEmailData): Promise<void> {
  const client = getResend()
  if (!client) {
    console.log('[Email] Resend deshabilitado (sin RESEND_API_KEY)')
    return
  }

  try {
    const asunto = data.cae
      ? `Factura N° ${String(data.nroFactura ?? '').padStart(8, '0')} — FAGU Drink Bar`
      : `Comprobante de compra #${data.saleId} — FAGU Drink Bar`

    const { error } = await client.emails.send({
      from:    FROM,
      to:      data.clienteEmail,
      subject: asunto,
      html:    buildHtml(data),
    })

    if (error) {
      console.error('[Email] Error al enviar:', error)
    } else {
      console.log(`[Email] Enviado a ${data.clienteEmail} (venta #${data.saleId})`)
    }
  } catch (err) {
    console.error('[Email] Error inesperado:', err)
  }
}
