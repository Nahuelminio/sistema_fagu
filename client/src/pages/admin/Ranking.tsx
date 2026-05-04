import { useEffect, useState } from 'react'
import api from '../../lib/api'

interface RankingItem {
  nombre: string
  tragoId: number | null
  productId: number | null
  qty: number
  revenue: number
  cost: number
  margin: number
  marginPct: number
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

const inputClass = 'rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500'

type SortKey = 'revenue' | 'margin' | 'marginPct' | 'qty'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'revenue',   label: 'Mayor ingreso' },
  { key: 'margin',    label: 'Mayor ganancia $' },
  { key: 'marginPct', label: 'Mayor margen %' },
  { key: 'qty',       label: 'Más vendido' },
]

export default function Ranking() {
  const [items, setItems]     = useState<RankingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom]       = useState('')
  const [to, setTo]           = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('revenue')

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to)   params.set('to', to)
      const res = await api.get<RankingItem[]>(`/ventas/ranking?${params}`)
      setItems(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const sorted = [...items].sort((a, b) => b[sortKey] - a[sortKey])
  const maxRevenue = sorted[0]?.revenue ?? 1
  const hasCosts = items.some((i) => i.cost > 0)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-zinc-100">Ranking de rentabilidad</h1>

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
            onClick={load}
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-400 transition"
          >
            Filtrar
          </button>
        </div>
      </div>

      {/* Ordenar */}
      <div className="flex flex-wrap gap-2">
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.key}
            onClick={() => setSortKey(o.key)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              sortKey === o.key
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-center text-sm text-zinc-500">Cargando...</p>
      ) : sorted.length === 0 ? (
        <p className="text-center text-sm text-zinc-500">Sin datos para este período</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((item, i) => {
            const barWidth = Math.round((item.revenue / maxRevenue) * 100)
            const hasCost  = item.cost > 0
            return (
              <div key={item.nombre} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-zinc-500 text-sm font-mono w-5 shrink-0">#{i + 1}</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{item.tragoId ? 'T' : 'P'}</span>
                    <p className="text-sm font-semibold text-zinc-100 truncate">{item.nombre}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-brand-400">{formatARS(item.revenue)}</p>
                    <p className="text-xs text-zinc-500">{item.qty} unid.</p>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div className="mt-2 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>

                {/* Costos y margen */}
                {hasCosts && (
                  <div className="mt-2 flex gap-4 text-xs">
                    <div>
                      <span className="text-zinc-600">Costo: </span>
                      <span className="text-zinc-400">{hasCost ? formatARS(item.cost) : '—'}</span>
                    </div>
                    <div>
                      <span className="text-zinc-600">Ganancia: </span>
                      <span className={hasCost ? (item.margin >= 0 ? 'text-green-400' : 'text-red-400') : 'text-zinc-600'}>
                        {hasCost ? formatARS(item.margin) : '—'}
                      </span>
                    </div>
                    {hasCost && (
                      <div>
                        <span className="text-zinc-600">Margen: </span>
                        <span className={item.marginPct >= 50 ? 'text-green-400' : item.marginPct >= 20 ? 'text-yellow-400' : 'text-red-400'}>
                          {item.marginPct}%
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
