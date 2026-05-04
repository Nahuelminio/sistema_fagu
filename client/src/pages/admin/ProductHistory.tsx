import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { Product } from '../../types'

interface Movement {
  id: number
  type: 'INGRESO' | 'SALIDA' | 'AJUSTE'
  quantity: string
  unitCost: string | null
  notes: string | null
  createdAt: string
  user: { name: string }
}

interface MovementsResponse {
  movements: Movement[]
  total: number
  page: number
  pages: number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

const TYPE_CONFIG = {
  INGRESO: { label: 'Ingreso', color: 'text-green-400', bg: 'bg-green-900/20 border-green-800/50', sign: '+' },
  SALIDA:  { label: 'Salida',  color: 'text-red-400',   bg: 'bg-red-900/20 border-red-800/50',     sign: '−' },
  AJUSTE:  { label: 'Ajuste',  color: 'text-yellow-400',bg: 'bg-yellow-900/20 border-yellow-800/50',sign: '~' },
}

export default function ProductHistory() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [data, setData]       = useState<MovementsResponse | null>(null)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)

  async function load(p = 1) {
    setLoading(true)
    try {
      const [prodRes, movRes] = await Promise.all([
        api.get<Product>(`/products/${id}`),
        api.get<MovementsResponse>(`/movements?productId=${id}&page=${p}&limit=30`),
      ])
      setProduct(prodRes.data)
      setData(movRes.data)
      setPage(p)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const totalIngreso = data?.movements.filter((m) => m.type === 'INGRESO').reduce((s, m) => s + Number(m.quantity), 0) ?? 0
  const totalSalida  = data?.movements.filter((m) => m.type === 'SALIDA').reduce((s, m) => s + Number(m.quantity), 0) ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/productos')} className="text-zinc-500 hover:text-zinc-300 transition text-sm">
          ← Productos
        </button>
      </div>

      {product && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">Producto</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-zinc-100">{product.name}</p>
              <p className="text-sm text-zinc-500">{product.category?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-brand-400">{Number(product.currentStock).toFixed(2)}</p>
              <p className="text-xs text-zinc-500">stock actual ({product.unit})</p>
            </div>
          </div>

          {data && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-green-900/40 bg-green-900/10 p-3">
                <p className="text-xs text-zinc-500">Total ingresado</p>
                <p className="text-lg font-bold text-green-400">+{totalIngreso.toFixed(2)} {product.unit}</p>
              </div>
              <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-3">
                <p className="text-xs text-zinc-500">Total salido</p>
                <p className="text-lg font-bold text-red-400">−{totalSalida.toFixed(2)} {product.unit}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Historial de movimientos</h2>

      {loading ? (
        <p className="text-center text-sm text-zinc-500">Cargando...</p>
      ) : data?.movements.length === 0 ? (
        <p className="text-center text-sm text-zinc-500">Sin movimientos registrados</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data?.movements.map((m) => {
            const cfg = TYPE_CONFIG[m.type]
            return (
              <div key={m.id} className={`rounded-2xl border px-4 py-3 ${cfg.bg}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold uppercase ${cfg.color}`}>{cfg.label}</span>
                      {m.notes && <span className="text-xs text-zinc-500 italic">"{m.notes}"</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-600">{formatDate(m.createdAt)} · {m.user.name}</p>
                    {m.unitCost && (
                      <p className="text-xs text-zinc-500">Costo: {formatARS(Number(m.unitCost))} / u</p>
                    )}
                  </div>
                  <p className={`text-lg font-bold ${cfg.color}`}>
                    {cfg.sign}{Number(m.quantity).toFixed(2)}
                  </p>
                </div>
              </div>
            )
          })}
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
