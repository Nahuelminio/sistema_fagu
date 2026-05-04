import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { VentasResponse, Sale } from '../../types'
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
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function VentaCard({ venta }: { venta: Sale }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl bg-white shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-gray-900">Venta #{venta.id}</p>
          <p className="text-xs text-gray-400">
            {formatDate(venta.createdAt)} · {venta.user.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge label={formatARS(Number(venta.total))} color="green" />
          <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 pb-3">
          {venta.notes && (
            <p className="mb-2 text-xs italic text-gray-400">"{venta.notes}"</p>
          )}
          <div className="flex flex-col gap-1">
            {venta.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {item.product.name} ×{item.quantity} {item.product.unit}
                </span>
                <span className="text-gray-500">
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

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-gray-900">Ventas</h1>

      {/* Filtros */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Desde</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Hasta</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>
          </div>
          <button
            onClick={() => load(1)}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Filtrar
          </button>
        </div>
      </div>

      {/* Resumen */}
      {data && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Ventas ({data.total})
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{data.total}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total</p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {formatARS(data.totalRevenue)}
            </p>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-center text-sm text-gray-400">Cargando...</p>
      ) : data?.ventas.length === 0 ? (
        <p className="text-center text-sm text-gray-400">No hay ventas en este período</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data?.ventas.map((v) => <VentaCard key={v.id} venta={v} />)}
        </div>
      )}

      {/* Paginación */}
      {data && data.pages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => load(page - 1)}
            className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="rounded-lg bg-white px-3 py-1 text-sm shadow-sm">
            {page} / {data.pages}
          </span>
          <button
            disabled={page >= data.pages}
            onClick={() => load(page + 1)}
            className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
