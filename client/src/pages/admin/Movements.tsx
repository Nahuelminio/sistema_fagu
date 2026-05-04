import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { MovementsResponse, Product } from '../../types'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

const typeColor = { INGRESO: 'green', SALIDA: 'red', AJUSTE: 'yellow' } as const
const selectClass = 'w-full rounded-xl border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500'

export default function Movements() {
  const [data, setData] = useState<MovementsResponse | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [filters, setFilters] = useState({ productId: '', from: '', to: '', type: '' })
  const [page, setPage] = useState(1)
  const [showIngreso, setShowIngreso] = useState(false)
  const [ingresoForm, setIngresoForm] = useState({ productId: '', quantity: '', unitCost: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { api.get<Product[]>('/products').then((r) => setProducts(r.data)) }, [])
  useEffect(() => { load() }, [page, filters])

  async function load() {
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (filters.productId) params.set('productId', filters.productId)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    if (filters.type) params.set('type', filters.type)
    const { data: res } = await api.get<MovementsResponse>(`/movements?${params}`)
    setData(res)
  }

  async function handleIngreso() {
    setSaving(true)
    try {
      await api.post('/movements/ingreso', {
        productId: parseInt(ingresoForm.productId),
        quantity: parseFloat(ingresoForm.quantity),
        unitCost: ingresoForm.unitCost ? parseFloat(ingresoForm.unitCost) : undefined,
        notes: ingresoForm.notes || undefined,
      })
      setShowIngreso(false)
      setIngresoForm({ productId: '', quantity: '', unitCost: '', notes: '' })
      load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">Movimientos</h1>
        <Button onClick={() => setShowIngreso(true)}>+ Ingreso</Button>
      </div>

      {showIngreso && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 font-semibold text-zinc-100">Registrar ingreso</h2>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-400">Producto</label>
              <select value={ingresoForm.productId} onChange={(e) => setIngresoForm({ ...ingresoForm, productId: e.target.value })} className={selectClass}>
                <option value="">Seleccionar...</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Cantidad" type="number" value={ingresoForm.quantity} onChange={(e) => setIngresoForm({ ...ingresoForm, quantity: e.target.value })} />
              <Input label="Costo unitario" type="number" value={ingresoForm.unitCost} onChange={(e) => setIngresoForm({ ...ingresoForm, unitCost: e.target.value })} />
            </div>
            <Input label="Notas (opcional)" value={ingresoForm.notes} onChange={(e) => setIngresoForm({ ...ingresoForm, notes: e.target.value })} />
            <div className="flex gap-2">
              <Button onClick={handleIngreso} loading={saving}>Guardar</Button>
              <Button variant="ghost" onClick={() => setShowIngreso(false)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Filtros</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Producto</label>
            <select value={filters.productId} onChange={(e) => { setFilters({ ...filters, productId: e.target.value }); setPage(1) }} className={selectClass}>
              <option value="">Todos</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Tipo</label>
            <select value={filters.type} onChange={(e) => { setFilters({ ...filters, type: e.target.value }); setPage(1) }} className={selectClass}>
              <option value="">Todos</option>
              <option value="INGRESO">Ingreso</option>
              <option value="SALIDA">Salida</option>
            </select>
          </div>
          <Input label="Desde" type="date" value={filters.from} onChange={(e) => { setFilters({ ...filters, from: e.target.value }); setPage(1) }} />
          <Input label="Hasta" type="date" value={filters.to} onChange={(e) => { setFilters({ ...filters, to: e.target.value }); setPage(1) }} />
        </div>
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-2">
        {data?.movements.map((m) => (
          <div key={m.id} className="flex items-start justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge label={m.type} color={typeColor[m.type]} />
                <p className="font-medium text-zinc-100">{m.product.name}</p>
              </div>
              <p className="text-xs text-zinc-500">{m.user.name} · {new Date(m.createdAt).toLocaleString('es-AR')}</p>
              {m.notes && <p className="mt-0.5 text-xs text-zinc-600">{m.notes}</p>}
            </div>
            <div className="text-right">
              <p className="font-semibold text-zinc-100">{m.quantity} {m.product.unit}</p>
              {m.unitCost && <p className="text-xs text-zinc-500">${m.unitCost}/u</p>}
            </div>
          </div>
        ))}
      </div>

      {data && data.pages > 1 && (
        <div className="flex justify-center gap-3">
          <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>← Anterior</Button>
          <span className="self-center text-sm text-zinc-500">{page} / {data.pages}</span>
          <Button variant="secondary" disabled={page === data.pages} onClick={() => setPage(page + 1)}>Siguiente →</Button>
        </div>
      )}
    </div>
  )
}
