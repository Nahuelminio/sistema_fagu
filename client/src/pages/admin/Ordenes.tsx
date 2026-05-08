import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { Product } from '../../types'
import Button from '../../components/ui/Button'
import { useToast } from '../../context/ToastContext'

interface Proveedor {
  id: number
  name: string
  phone?: string | null
  email?: string | null
}

interface OrdenItem {
  id: number
  productId: number
  quantity: string
  unitCost: string | null
  received: string
  product: { id: number; name: string; unit: string }
}

interface Orden {
  id: number
  status: 'PENDIENTE' | 'RECIBIDA' | 'CANCELADA'
  notes: string | null
  createdAt: string
  proveedor: Proveedor | null
  items: OrdenItem[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const STATUS_CONFIG = {
  PENDIENTE:  { label: 'Pendiente',  color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-800/50' },
  RECIBIDA:   { label: 'Recibida',   color: 'text-green-400',  bg: 'bg-green-900/20 border-green-800/50'  },
  CANCELADA:  { label: 'Cancelada',  color: 'text-red-400',    bg: 'bg-red-900/20 border-red-800/50'      },
}

const inputClass = 'rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500 w-full'

export default function Ordenes() {
  const { showToast } = useToast()
  const [ordenes, setOrdenes]         = useState<Orden[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [products, setProducts]       = useState<Product[]>([])
  const [loading, setLoading]         = useState(true)
  const [view, setView]               = useState<'list' | 'create' | 'detail'>('list')
  const [detailOrden, setDetailOrden] = useState<Orden | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')

  // Formulario nueva orden
  const [proveedorId, setProveedorId] = useState('')
  const [notes, setNotes]             = useState('')
  const [orderItems, setOrderItems]   = useState<{ productId: string; quantity: string; unitCost: string }[]>([
    { productId: '', quantity: '', unitCost: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Nuevo proveedor
  const [showNewProv, setShowNewProv]   = useState(false)
  const [newProvName, setNewProvName]   = useState('')
  const [newProvPhone, setNewProvPhone] = useState('')

  async function load() {
    setLoading(true)
    try {
      const params = statusFilter ? `?status=${statusFilter}` : ''
      const [orRes, provRes, prodRes] = await Promise.all([
        api.get<Orden[]>(`/ordenes${params}`),
        api.get<Proveedor[]>('/ordenes/proveedores'),
        api.get<Product[]>('/products'),
      ])
      setOrdenes(orRes.data)
      setProveedores(provRes.data)
      setProducts(prodRes.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [statusFilter])

  async function handleCreateOrden() {
    const items = orderItems.filter((i) => i.productId && i.quantity)
    if (items.length === 0) { setError('Agregá al menos un producto'); return }
    setSaving(true)
    setError('')
    try {
      await api.post('/ordenes', {
        proveedorId: proveedorId ? parseInt(proveedorId) : undefined,
        notes: notes || undefined,
        items: items.map((i) => ({
          productId: parseInt(i.productId),
          quantity:  parseFloat(i.quantity),
          unitCost:  i.unitCost ? parseFloat(i.unitCost) : undefined,
        })),
      })
      showToast('Orden de compra creada')
      setView('list')
      setOrderItems([{ productId: '', quantity: '', unitCost: '' }])
      setProveedorId('')
      setNotes('')
      load()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al crear')
    } finally {
      setSaving(false)
    }
  }

  async function handleRecibir(id: number) {
    try {
      await api.post(`/ordenes/${id}/recibir`, {})
      showToast(`Orden #${id} marcada como recibida`)
      load()
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? 'Error al recibir la orden', 'error')
    }
  }

  async function handleCancelar(id: number) {
    if (!confirm('¿Cancelar esta orden?')) return
    try {
      await api.post(`/ordenes/${id}/cancelar`, {})
      showToast(`Orden #${id} cancelada`, 'info')
      load()
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? 'Error al cancelar la orden', 'error')
    }
  }

  async function handleCreateProveedor() {
    if (!newProvName) return
    try {
      const res = await api.post<Proveedor>('/ordenes/proveedores', { name: newProvName, phone: newProvPhone || undefined })
      setProveedores((prev) => [...prev, res.data])
      setProveedorId(String(res.data.id))
      setNewProvName('')
      setNewProvPhone('')
      setShowNewProv(false)
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? 'Error al crear proveedor', 'error')
    }
  }

  // ── Vista: lista ─────────────────────────────────────────────────────────────
  if (view === 'list') return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">Órdenes de compra</h1>
        <Button type="button" onClick={() => { setView('create'); setError('') }}>
          + Nueva
        </Button>
      </div>

      {/* Filtro */}
      <div className="flex gap-2 flex-wrap">
        {['', 'PENDIENTE', 'RECIBIDA', 'CANCELADA'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === s ? 'border-brand-500 bg-brand-500 text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {s || 'Todas'}
          </button>
        ))}
      </div>

      {loading ? <p className="text-center text-sm text-zinc-500">Cargando...</p>
      : ordenes.length === 0 ? <p className="text-center text-sm text-zinc-600">Sin órdenes</p>
      : ordenes.map((orden) => {
        const cfg = STATUS_CONFIG[orden.status]
        return (
          <div key={orden.id} className={`rounded-2xl border p-4 ${cfg.bg}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-zinc-100">Orden #{orden.id}</p>
                  <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                </div>
                <p className="text-xs text-zinc-500">{formatDate(orden.createdAt)}{orden.proveedor ? ` · ${orden.proveedor.name}` : ''}</p>
              </div>
              <button onClick={() => { setDetailOrden(orden); setView('detail') }} className="text-xs text-zinc-500 hover:text-zinc-300">Ver →</button>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {orden.items.map((item) => (
                <div key={item.id} className="flex justify-between text-xs text-zinc-500">
                  <span>{item.product.name}</span>
                  <span>{Number(item.quantity)} {item.product.unit}</span>
                </div>
              ))}
            </div>
            {orden.status === 'PENDIENTE' && (
              <div className="mt-3 flex gap-2">
                <button onClick={() => handleRecibir(orden.id)} className="flex-1 rounded-lg bg-green-800/50 px-3 py-1.5 text-xs font-semibold text-green-300 hover:bg-green-700/50 transition">Recibir</button>
                <button onClick={() => handleCancelar(orden.id)} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 hover:text-red-400 transition">Cancelar</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  // ── Vista: detalle ───────────────────────────────────────────────────────────
  if (view === 'detail' && detailOrden) {
    const cfg = STATUS_CONFIG[detailOrden.status]
    return (
      <div className="flex flex-col gap-4">
        <button onClick={() => setView('list')} className="text-sm text-zinc-500 hover:text-zinc-300 transition">← Órdenes</button>
        <div className={`rounded-2xl border p-4 ${cfg.bg}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-bold text-zinc-100">Orden #{detailOrden.id}</p>
              <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
            </div>
            <p className="text-xs text-zinc-500">{formatDate(detailOrden.createdAt)}</p>
          </div>
          {detailOrden.proveedor && <p className="mt-1 text-sm text-zinc-400">Proveedor: {detailOrden.proveedor.name}</p>}
          {detailOrden.notes && <p className="mt-1 text-xs italic text-zinc-500">"{detailOrden.notes}"</p>}
          <div className="mt-3 flex flex-col divide-y divide-zinc-700">
            {detailOrden.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-zinc-300">{item.product.name}</span>
                <span className="text-zinc-500">{Number(item.quantity)} {item.product.unit}{item.unitCost ? ` · $${item.unitCost}/u` : ''}</span>
              </div>
            ))}
          </div>
          {detailOrden.status === 'PENDIENTE' && (
            <div className="mt-3 flex gap-2">
              <button onClick={() => { handleRecibir(detailOrden.id); setView('list') }} className="flex-1 rounded-lg bg-green-800/50 px-3 py-1.5 text-sm font-semibold text-green-300 hover:bg-green-700/50 transition">Marcar como recibida</button>
              <button onClick={() => { handleCancelar(detailOrden.id); setView('list') }} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-500 hover:text-red-400 transition">Cancelar</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Vista: crear orden ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => setView('list')} className="text-sm text-zinc-500 hover:text-zinc-300 transition">← Órdenes</button>
      <h2 className="text-lg font-bold text-zinc-100">Nueva orden de compra</h2>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-3">
        {/* Proveedor */}
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Proveedor (opcional)</label>
          <div className="flex gap-2">
            <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} className={inputClass}>
              <option value="">Sin proveedor</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={() => setShowNewProv((v) => !v)} className="rounded-xl border border-zinc-700 px-3 text-xs text-zinc-400 hover:text-zinc-200 whitespace-nowrap">+ Nuevo</button>
          </div>
        </div>

        {showNewProv && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-3 flex flex-col gap-2">
            <input placeholder="Nombre del proveedor" value={newProvName} onChange={(e) => setNewProvName(e.target.value)} className="rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 outline-none w-full" />
            <input placeholder="Teléfono (opcional)" value={newProvPhone} onChange={(e) => setNewProvPhone(e.target.value)} className="rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 outline-none w-full" />
            <button onClick={handleCreateProveedor} className="rounded-lg bg-zinc-600 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-500">Guardar proveedor</button>
          </div>
        )}

        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Notas</label>
          <input placeholder="Notas opcionales" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </div>

        {/* Items */}
        <div>
          <label className="text-xs text-zinc-500 mb-2 block">Productos</label>
          <div className="flex flex-col gap-2">
            {orderItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_5rem_5rem_auto] gap-2 items-center">
                <select
                  value={item.productId}
                  onChange={(e) => setOrderItems((prev) => prev.map((i, j) => j === idx ? { ...i, productId: e.target.value } : i))}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-2 py-2 text-xs text-zinc-100 outline-none"
                >
                  <option value="">Producto...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input
                  type="number" placeholder="Cant." min="0" step="0.001"
                  value={item.quantity}
                  onChange={(e) => setOrderItems((prev) => prev.map((i, j) => j === idx ? { ...i, quantity: e.target.value } : i))}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-2 py-2 text-xs text-zinc-100 outline-none w-full"
                />
                <input
                  type="number" placeholder="$/u" min="0"
                  value={item.unitCost}
                  onChange={(e) => setOrderItems((prev) => prev.map((i, j) => j === idx ? { ...i, unitCost: e.target.value } : i))}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-2 py-2 text-xs text-zinc-100 outline-none w-full"
                />
                <button
                  onClick={() => setOrderItems((prev) => prev.filter((_, j) => j !== idx))}
                  disabled={orderItems.length === 1}
                  className="text-zinc-600 hover:text-red-400 disabled:opacity-30"
                >×</button>
              </div>
            ))}
            <button
              onClick={() => setOrderItems((prev) => [...prev, { productId: '', quantity: '', unitCost: '' }])}
              className="text-xs text-brand-400 hover:text-brand-300 transition text-left"
            >
              + Agregar producto
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="button" onClick={handleCreateOrden} loading={saving}>Crear orden</Button>
      </div>
    </div>
  )
}
