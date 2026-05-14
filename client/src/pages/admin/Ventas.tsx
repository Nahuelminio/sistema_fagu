import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { VentasResponse, Sale, PAYMENT_LABELS, PaymentMethod } from '../../types'
import Badge from '../../components/ui/Badge'
import FacturaModal from '../../components/FacturaModal'

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function VentaCard({ venta, onAnular }: { venta: Sale; onAnular: () => void }) {
  const [open, setOpen] = useState(false)
  const [showFactura, setShowFactura] = useState(false)
  const [showAnular, setShowAnular] = useState(false)
  const hasFactura = !!venta.cae
  const isAnulada  = !!venta.anulada

  async function doAnular(motivo: string) {
    setShowAnular(false)
    try {
      const res = await api.post<{ ok: boolean; nc: { cae: string; nroFactura: number; puntoVenta: number } | null; ncError: string | null }>(
        `/ventas/${venta.id}/anular`, { motivo }
      )
      if (res.data.ncError) {
        alert(`Venta anulada pero ARCA rechazó la Nota de Crédito:\n\n${res.data.ncError}\n\nPodés reintentar la NC más adelante.`)
      } else if (res.data.nc) {
        alert(`Venta anulada · Nota de Crédito ${String(res.data.nc.puntoVenta).padStart(4, '0')}-${String(res.data.nc.nroFactura).padStart(8, '0')} emitida en ARCA`)
      }
      onAnular()
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Error al anular')
    }
  }

  return (
    <div className={`rounded-2xl border ${isAnulada ? 'border-red-900/40 bg-red-950/20 opacity-70' : 'border-zinc-800 bg-zinc-900'}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-semibold ${isAnulada ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>
              Venta #{venta.id}
            </p>
            {isAnulada && (
              <span className="rounded-full bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-xs text-red-300 font-medium">
                Anulada
              </span>
            )}
            {venta.cliente && (
              <span className="rounded-full bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                {venta.cliente.nombre}
              </span>
            )}
            {hasFactura && (
              <span className="rounded-full bg-brand-500/10 border border-brand-500/30 px-2 py-0.5 text-xs text-brand-400 font-medium">
                Facturada
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            {formatDate(venta.createdAt)} · {venta.user.name}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          <Badge label={PAYMENT_LABELS[venta.paymentMethod as PaymentMethod]} color="gray" />
          <span className={`font-semibold ${isAnulada ? 'text-zinc-600 line-through' : 'text-brand-400'}`}>
            {formatARS(Number(venta.total))}
          </span>
          <span className="text-xs text-zinc-600">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-zinc-800 px-4 pb-3 pt-2">
          {venta.notes && (
            <p className="mb-2 text-xs italic text-zinc-500">"{venta.notes}"</p>
          )}
          <div className="flex flex-col gap-1">
            {venta.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-zinc-400">
                  {item.nombre || item.product?.name || item.trago?.name} ×{item.quantity} {item.product?.unit ?? 'u'}
                </span>
                <span className="text-zinc-500">
                  {formatARS(Number(item.unitPrice) * Number(item.quantity))}
                </span>
              </div>
            ))}
          </div>

          {/* Datos de factura */}
          {hasFactura && (
            <div className="mt-3 rounded-xl border border-brand-500/20 bg-brand-500/5 px-3 py-2 flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-400">Factura electronica</p>
                <button
                  onClick={() => setShowFactura(true)}
                  className="rounded-lg bg-brand-500 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-400 transition"
                >
                  Ver factura
                </button>
              </div>
              {venta.nroFactura != null && (
                <p className="text-xs text-zinc-400 mt-1">
                  Comprobante:{' '}
                  <span className="font-mono text-zinc-200">
                    {String(venta.puntoVenta ?? 1).padStart(4, '0')}-{String(venta.nroFactura).padStart(8, '0')}
                  </span>
                </p>
              )}
              <p className="text-xs text-zinc-400">
                CAE: <span className="font-mono text-zinc-300">{venta.cae}</span>
              </p>
              {venta.cliente && (
                <p className="text-xs text-zinc-400">
                  Cliente:{' '}
                  <span className="text-zinc-200">{venta.cliente.nombre}</span>
                  {(venta.cliente.cuit || venta.cliente.dni) && (
                    <span className="text-zinc-500 ml-1">
                      ({venta.cliente.cuit ? `CUIT ${venta.cliente.cuit}` : `DNI ${venta.cliente.dni}`})
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Motivo de anulación + Nota de Crédito */}
          {isAnulada && (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-950/30 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Venta anulada</p>
              {venta.anuladaAt && (
                <p className="text-xs text-zinc-400 mt-1">El {formatDate(venta.anuladaAt)}</p>
              )}
              {venta.motivoAnulacion && (
                <p className="text-xs text-zinc-300 mt-1 italic">"{venta.motivoAnulacion}"</p>
              )}
              {venta.ncCae && (
                <div className="mt-2 pt-2 border-t border-red-500/20">
                  <p className="text-xs text-zinc-400">
                    Nota de Crédito:{' '}
                    <span className="font-mono text-zinc-200">
                      {String(venta.ncPuntoVenta ?? 0).padStart(4, '0')}-{String(venta.ncNroFactura ?? 0).padStart(8, '0')}
                    </span>
                  </p>
                  <p className="text-xs text-zinc-400">
                    CAE NC: <span className="font-mono text-zinc-300">{venta.ncCae}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Botón anular — solo si no está ya anulada */}
          {!isAnulada && (
            <div className="mt-3 border-t border-zinc-800 pt-3 flex justify-end">
              <button
                onClick={() => setShowAnular(true)}
                className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-950/60 transition"
              >
                Anular venta
              </button>
            </div>
          )}
        </div>
      )}

      {showFactura && <FacturaModal sale={venta} onClose={() => setShowFactura(false)} />}
      {showAnular && (
        <AnularModal
          ventaId={venta.id}
          tieneFactura={hasFactura}
          onConfirm={doAnular}
          onClose={() => setShowAnular(false)}
        />
      )}
    </div>
  )
}

/** Modal con motivos rápidos para anular una venta */
function AnularModal({
  ventaId, tieneFactura, onConfirm, onClose,
}: {
  ventaId: number
  tieneFactura: boolean
  onConfirm: (motivo: string) => void
  onClose: () => void
}) {
  const [otro, setOtro] = useState('')
  const [showOtro, setShowOtro] = useState(false)

  const motivos = [
    'Error del cajero',
    'Cliente se arrepintió',
    'Producto en mal estado',
    'Sin especificar',
  ]

  function elegir(motivo: string) {
    onConfirm(motivo)
  }

  function confirmarOtro() {
    const m = otro.trim()
    if (m.length < 3) {
      alert('Escribí al menos 3 caracteres')
      return
    }
    onConfirm(m)
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
      >
        <h3 className="text-base font-semibold text-zinc-100">Anular venta #{ventaId}</h3>
        <p className="mt-1 text-xs text-zinc-500">Elegí el motivo</p>
        {tieneFactura && (
          <p className="mt-2 rounded-lg border border-brand-500/30 bg-brand-500/10 px-2 py-1.5 text-xs text-brand-300">
            Se va a emitir una Nota de Crédito automática en ARCA
          </p>
        )}

        {!showOtro ? (
          <div className="mt-4 flex flex-col gap-2">
            {motivos.map((m) => (
              <button
                key={m}
                onClick={() => elegir(m)}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:border-red-500/50 hover:bg-red-950/30 transition text-left"
              >
                {m}
              </button>
            ))}
            <button
              onClick={() => setShowOtro(true)}
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition text-left"
            >
              Otro motivo...
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            <input
              type="text"
              value={otro}
              onChange={(e) => setOtro(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmarOtro() }}
              autoFocus
              placeholder="Escribí el motivo..."
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500"
            />
            <div className="flex gap-2">
              <button
                onClick={confirmarOtro}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400 transition"
              >
                Anular
              </button>
              <button
                onClick={() => { setShowOtro(false); setOtro('') }}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition"
              >
                Volver
              </button>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full text-xs text-zinc-500 hover:text-zinc-300 transition"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

const inputClass = 'rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500 w-full'

function exportCSV(ventas: Sale[], fromDate: string, toDate: string) {
  const rows: string[] = []
  rows.push(['ID', 'Fecha', 'Usuario', 'Medio de pago', 'Subtotal', 'Descuento', 'Total', 'Items', 'Notas'].join(','))
  for (const v of ventas) {
    const items = v.items.map((i) => `${i.nombre || i.product?.name || i.trago?.name} x${i.quantity}`).join(' | ')
    rows.push([
      v.id,
      new Date(v.createdAt).toLocaleString('es-AR'),
      `"${v.user.name}"`,
      PAYMENT_LABELS[v.paymentMethod as PaymentMethod],
      Number(v.subtotal ?? v.total),
      Number(v.discount ?? 0),
      Number(v.total),
      `"${items}"`,
      `"${v.notes ?? ''}"`,
    ].join(','))
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const suffix = fromDate && toDate ? `_${fromDate}_${toDate}` : fromDate ? `_desde_${fromDate}` : toDate ? `_hasta_${toDate}` : ''
  a.download = `ventas${suffix}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Ventas() {
  const [data, setData] = useState<VentasResponse | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  async function load(p = 1) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await api.get<VentasResponse>(`/ventas?${params}`)
      setData(res.data)
      setPage(p)
    } finally {
      setLoading(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const params = new URLSearchParams({ page: '1', limit: '5000' })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await api.get<VentasResponse>(`/ventas?${params}`)
      exportCSV(res.data.ventas, from, to)
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-zinc-100">Ventas</h1>

      {/* Filtros */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Desde</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Hasta</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => load(1)}
              className="flex-1 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-400 transition"
            >
              Filtrar
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-700 transition disabled:opacity-50"
            >
              {exporting ? 'Exportando...' : 'Exportar CSV'}
            </button>
          </div>
        </div>
      </div>

      {/* Resumen */}
      {data && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Cantidad</p>
            <p className="mt-1 text-2xl font-bold text-zinc-100">{data.total}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Total</p>
            <p className="mt-1 text-2xl font-bold text-brand-400">{formatARS(data.totalRevenue)}</p>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-center text-sm text-zinc-500">Cargando...</p>
      ) : data?.ventas.length === 0 ? (
        <p className="text-center text-sm text-zinc-500">No hay ventas en este período</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data?.ventas.map((v) => <VentaCard key={v.id} venta={v} onAnular={() => load(page)} />)}
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page <= 1} onClick={() => load(page - 1)} className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-400 disabled:opacity-40">← Anterior</button>
          <span className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1 text-sm text-zinc-400">{page} / {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => load(page + 1)} className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-400 disabled:opacity-40">Siguiente →</button>
        </div>
      )}
    </div>
  )
}
