import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { VentasResponse, Sale, PAYMENT_LABELS, PaymentMethod } from '../../types'
import Badge from '../../components/ui/Badge'

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

function VentaCard({ venta }: { venta: Sale }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-zinc-100">Venta #{venta.id}</p>
          <p className="text-xs text-zinc-500">
            {formatDate(venta.createdAt)} · {venta.user.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge label={PAYMENT_LABELS[venta.paymentMethod as PaymentMethod]} color="gray" />
          <span className="font-semibold text-brand-400">{formatARS(Number(venta.total))}</span>
          <span className="text-xs text-zinc-600">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-zinc-800 px-4 pb-3">
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
        </div>
      )}
    </div>
  )
}

const inputClass = 'rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500 w-full'

export default function Ventas() {
  const [data, setData] = useState<VentasResponse | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

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
          <button
            onClick={() => load(1)}
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-400 transition"
          >
            Filtrar
          </button>
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
          {data?.ventas.map((v) => <VentaCard key={v.id} venta={v} />)}
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
