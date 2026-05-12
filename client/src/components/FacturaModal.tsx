import { QRCodeSVG } from 'qrcode.react'
import { Sale, PAYMENT_LABELS, PaymentMethod } from '../types'

/**
 * Modal con la representación visual de la factura electrónica.
 * Cumple con los datos obligatorios de RG 4291 (incluye QR).
 */

const EMISOR = {
  razonSocial: 'DOÑA ZOPPI S.R.L.',
  nombreFantasia: 'FAGU Drink Bar',
  cuit: '30-71821464-1',
  cuitNum: 30718214641,
  domicilio: 'Los Girasoles 10688 — Posadas, Misiones',
  condicionIVA: 'Responsable Inscripto',
  ingresosBrutos: '-',
  inicioActividades: '-',
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Construye el payload del QR según RG 4291 de AFIP/ARCA */
function buildQrUrl(sale: Sale): string {
  if (!sale.cae || !sale.nroFactura || !sale.puntoVenta) return ''

  const fechaStr = sale.createdAt.slice(0, 10) // YYYY-MM-DD

  const tipoDocRec = sale.cliente?.cuit ? 80 : sale.cliente?.dni ? 96 : 99
  const nroDocRec  = Number((sale.cliente?.cuit ?? sale.cliente?.dni ?? '0').replace(/\D/g, ''))

  const data = {
    ver: 1,
    fecha: fechaStr,
    cuit: EMISOR.cuitNum,
    ptoVta: sale.puntoVenta,
    tipoCmp: 6, // Factura B
    nroCmp: sale.nroFactura,
    importe: Number(sale.total),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec,
    nroDocRec,
    tipoCodAut: 'E',
    codAut: Number(sale.cae),
  }

  const json   = JSON.stringify(data)
  const base64 = btoa(json)
  return `https://www.afip.gob.ar/fe/qr/?p=${base64}`
}

export default function FacturaModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  if (!sale.cae) return null

  const qrUrl = buildQrUrl(sale)
  const neto  = Number(sale.total) / 1.21
  const iva   = Number(sale.total) - neto
  const docTipoLabel =
    sale.cliente?.cuit ? `CUIT ${sale.cliente.cuit}` :
    sale.cliente?.dni  ? `DNI ${sale.cliente.dni}` :
    'Consumidor Final'

  const nroComp = `${String(sale.puntoVenta ?? 6).padStart(4, '0')}-${String(sale.nroFactura ?? 0).padStart(8, '0')}`

  function handlePrint() { window.print() }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur print:bg-white print:p-0"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="my-8 w-full max-w-2xl rounded-2xl bg-white text-zinc-900 shadow-2xl print:my-0 print:rounded-none print:shadow-none"
        id="factura-print"
      >
        {/* Header con tipo de comprobante */}
        <div className="grid grid-cols-3 border-b-2 border-zinc-300">
          <div className="p-5">
            <img
              src="/logo.png"
              alt="FAGU Drink Bar"
              className="h-40 w-40 rounded-full object-cover mb-2"
              onError={(e) => {
                // fallback al texto si falla la carga
                const img = e.target as HTMLImageElement
                img.style.display = 'none'
                const fallback = img.nextElementSibling as HTMLElement | null
                if (fallback) fallback.style.display = 'block'
              }}
            />
            <div style={{ display: 'none' }}>
              <p className="text-2xl font-black tracking-wider">FAGU</p>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">Drink Bar</p>
            </div>
            <p className="text-sm font-semibold text-zinc-800 mt-2">{EMISOR.nombreFantasia}</p>
            <p className="text-[10px] text-zinc-500">{EMISOR.razonSocial}</p>
            <p className="text-[10px] text-zinc-600 mt-1">CUIT: {EMISOR.cuit}</p>
            <p className="text-[10px] text-zinc-600">Ing. Brutos: {EMISOR.ingresosBrutos}</p>
            <p className="text-[10px] text-zinc-600">{EMISOR.condicionIVA}</p>
            <p className="text-[10px] text-zinc-600 mt-1">{EMISOR.domicilio}</p>
          </div>

          {/* Centro: letra B */}
          <div className="flex flex-col items-center justify-center border-x-2 border-zinc-300 py-4">
            <div className="border-2 border-zinc-900 w-16 h-16 flex items-center justify-center">
              <span className="text-5xl font-black">B</span>
            </div>
            <p className="mt-1 text-[10px] font-semibold uppercase">Cód. 06</p>
          </div>

          {/* Derecha: nro y fecha */}
          <div className="p-5 text-right">
            <p className="text-lg font-bold">FACTURA</p>
            <p className="text-sm font-mono mt-1">N° {nroComp}</p>
            <p className="text-xs text-zinc-700 mt-3">Fecha de emisión:</p>
            <p className="text-xs font-medium">{formatFecha(sale.createdAt)}</p>
          </div>
        </div>

        {/* Cliente */}
        <div className="border-b border-zinc-300 px-5 py-3">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Cliente</p>
              <p className="font-medium">{sale.cliente?.nombre ?? 'Consumidor Final'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Documento</p>
              <p className="font-medium">{docTipoLabel}</p>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Condición frente al IVA</p>
              <p className="font-medium">Consumidor Final</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Condición de venta</p>
              <p className="font-medium">{PAYMENT_LABELS[sale.paymentMethod as PaymentMethod]}</p>
            </div>
          </div>
        </div>

        {/* Items */}
        <table className="w-full text-xs">
          <thead className="border-b border-zinc-300 bg-zinc-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-zinc-600">Producto/Servicio</th>
              <th className="px-3 py-2 text-center font-semibold uppercase tracking-wide text-zinc-600">Cant.</th>
              <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-zinc-600">P. Unit.</th>
              <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-zinc-600">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id} className="border-b border-zinc-100">
                <td className="px-3 py-2">{item.nombre || item.product?.name || item.trago?.name}</td>
                <td className="px-3 py-2 text-center">{Number(item.quantity)}</td>
                <td className="px-3 py-2 text-right">{formatARS(Number(item.unitPrice))}</td>
                <td className="px-3 py-2 text-right">{formatARS(Number(item.unitPrice) * Number(item.quantity))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className="border-t border-zinc-300 px-5 py-3">
          <div className="ml-auto w-64 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-600">Importe Neto Gravado:</span>
              <span className="font-medium">{formatARS(neto)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">IVA 21%:</span>
              <span className="font-medium">{formatARS(iva)}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-300 pt-1 text-base">
              <span className="font-bold">TOTAL:</span>
              <span className="font-bold">{formatARS(Number(sale.total))}</span>
            </div>
          </div>
        </div>

        {/* CAE + QR */}
        <div className="grid grid-cols-3 gap-4 border-t-2 border-zinc-300 p-5">
          <div className="col-span-2 text-xs">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Comprobante Autorizado</p>
            <div className="mt-2 space-y-1">
              <div>
                <span className="text-zinc-600">CAE N°: </span>
                <span className="font-mono font-bold">{sale.cae}</span>
              </div>
              <div>
                <span className="text-zinc-600">Vencimiento CAE: </span>
                <span className="font-medium">
                  {sale.caeVencimiento ? new Date(sale.caeVencimiento).toLocaleDateString('es-AR') : '-'}
                </span>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-zinc-500">
              Esta factura fue emitida electrónicamente y autorizada por ARCA (AFIP).
              Para verificar su autenticidad escanee el código QR.
            </p>
          </div>
          <div className="flex flex-col items-center">
            {qrUrl && (
              <a href={qrUrl} target="_blank" rel="noopener noreferrer">
                <QRCodeSVG value={qrUrl} size={110} level="M" />
              </a>
            )}
            <p className="mt-1 text-[9px] text-zinc-500">Validá en ARCA</p>
          </div>
        </div>

        {/* Acciones — no se imprimen */}
        <div className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-3 print:hidden">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 transition"
          >
            Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Estilos de impresión */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #factura-print, #factura-print * { visibility: visible; }
          #factura-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  )
}
