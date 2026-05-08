import { useEffect, useState } from 'react'
import api from '../lib/api'
import { Product, Trago, PaymentMethod, PAYMENT_LABELS } from '../types'
import Button from '../components/ui/Button'
import { useToast } from '../context/ToastContext'

interface Cliente { id: number; nombre: string; cuit?: string | null; dni?: string | null }

// ── Tipos del carrito ──────────────────────────────────────────────────────
interface CartItem {
  type: 'product' | 'trago'
  id: number
  name: string
  unit: string
  salePrice: number
  quantity: number
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

const selectClass = 'w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-brand-500'
const CASH: PaymentMethod = 'EFECTIVO'

export default function RegisterVenta() {
  const { showToast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [tragos, setTragos]     = useState<Trago[]>([])
  const [cart, setCart]         = useState<CartItem[]>([])
  const [tab, setTab]           = useState<'product' | 'trago'>('trago')
  const [selectedId, setSelectedId] = useState('')
  const [quantity, setQuantity]     = useState('1')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(CASH)
  const [discount, setDiscount] = useState('')
  const [notes, setNotes]       = useState('')
  const [facturaEfectivo, setFacturaEfectivo] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [clientes, setClientes]     = useState<Cliente[]>([])
  const [clienteId, setClienteId]   = useState<number | null>(null)
  const [clienteSearch, setClienteSearch] = useState('')
  const [showClienteList, setShowClienteList] = useState(false)

  useEffect(() => {
    api.get<Product[]>('/products').then((r) => setProducts(r.data))
    api.get<Trago[]>('/tragos').then((r) => setTragos(r.data))
    api.get<Cliente[]>('/clientes').then((r) => setClientes(r.data)).catch(() => {})
  }, [])

  const clienteSeleccionado = clientes.find((c) => c.id === clienteId) ?? null
  const clientesFiltrados   = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(clienteSearch.toLowerCase()) ||
    (c.cuit ?? '').includes(clienteSearch) ||
    (c.dni  ?? '').includes(clienteSearch)
  )

  // No-efectivo siempre genera factura; efectivo solo si el checkbox está activo
  const generarFactura = paymentMethod !== CASH || facturaEfectivo

  const availableProducts = products.filter(
    (p) => Number(p.currentStock) > 0 && !cart.some((i) => i.type === 'product' && i.id === p.id)
  )
  const availableTragos = tragos.filter(
    (t) => t.active && !cart.some((i) => i.type === 'trago' && i.id === t.id)
  )

  function addToCart() {
    const qty = parseFloat(quantity)
    if (!selectedId || !qty || qty <= 0) return

    if (tab === 'product') {
      const p = products.find((p) => p.id === parseInt(selectedId))
      if (!p) return
      setCart((prev) => {
        const ex = prev.find((i) => i.type === 'product' && i.id === p.id)
        if (ex) return prev.map((i) => i.type === 'product' && i.id === p.id ? { ...i, quantity: i.quantity + qty } : i)
        return [...prev, { type: 'product', id: p.id, name: p.name, unit: p.unit, salePrice: Number(p.salePrice ?? 0), quantity: qty }]
      })
    } else {
      const t = tragos.find((t) => t.id === parseInt(selectedId))
      if (!t) return
      setCart((prev) => {
        const ex = prev.find((i) => i.type === 'trago' && i.id === t.id)
        if (ex) return prev.map((i) => i.type === 'trago' && i.id === t.id ? { ...i, quantity: i.quantity + qty } : i)
        return [...prev, { type: 'trago', id: t.id, name: t.name, unit: 'u', salePrice: Number(t.salePrice ?? 0), quantity: qty }]
      })
    }
    setSelectedId('')
    setQuantity('1')
  }

  function removeFromCart(type: string, id: number) {
    setCart((prev) => prev.filter((i) => !(i.type === type && i.id === id)))
  }
  function updateQty(type: string, id: number, qty: number) {
    if (qty <= 0) { removeFromCart(type, id); return }
    setCart((prev) => prev.map((i) => i.type === type && i.id === id ? { ...i, quantity: qty } : i))
  }

  const subtotal    = cart.reduce((sum, i) => sum + i.salePrice * i.quantity, 0)
  const discountAmt = parseFloat(discount) || 0
  const total       = Math.max(0, subtotal - discountAmt)

  async function handleSubmit() {
    if (cart.length === 0) return
    setError('')
    setSaving(true)
    try {
      const items = cart.map((i) =>
        i.type === 'product'
          ? { productId: i.id, quantity: i.quantity }
          : { tragoId: i.id, quantity: i.quantity }
      )
      const res = await api.post('/ventas', {
        items,
        paymentMethod,
        discount: discountAmt,
        notes: notes || undefined,
        generarFactura,
        clienteId: clienteId ?? undefined,
      })
      const cae = res.data.cae
      showToast(
        cae
          ? `Venta #${res.data.id} registrada — ${formatARS(Number(res.data.total))} — CAE: ${cae}`
          : `Venta #${res.data.id} registrada — ${formatARS(Number(res.data.total))}`
      )
      setCart([])
      setPaymentMethod(CASH)
      setDiscount('')
      setNotes('')
      setFacturaEfectivo(false)
      setClienteId(null)
      setClienteSearch('')
      api.get<Product[]>('/products').then((r) => setProducts(r.data))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Error al registrar la venta')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-zinc-100">Registrar venta</h1>

      {/* Selector */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        {/* Tabs */}
        <div className="mb-3 flex rounded-xl border border-zinc-800 bg-zinc-950 p-1">
          {(['trago', 'product'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelectedId('') }}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                tab === t ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t === 'trago' ? 'Tragos' : 'Productos'}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={selectClass}>
            <option value="">
              {tab === 'trago' ? 'Seleccionar trago...' : 'Seleccionar producto...'}
            </option>
            {tab === 'trago'
              ? availableTragos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.salePrice ? ` — ${formatARS(Number(t.salePrice))}` : ''}
                  </option>
                ))
              : availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — stock: {p.currentStock} {p.unit}
                    {p.salePrice ? ` — ${formatARS(Number(p.salePrice))}` : ''}
                  </option>
                ))}
          </select>

          <div className="flex gap-2">
            <input
              type="number" step="0.001" min="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Cant."
              className="w-24 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-brand-500"
            />
            <Button type="button" onClick={addToCart} disabled={!selectedId} className="flex-1">
              + Agregar
            </Button>
          </div>
        </div>
      </div>

      {/* Carrito */}
      {cart.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Carrito</p>
          <div className="flex flex-col divide-y divide-zinc-800">
            {cart.map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex items-center justify-between py-2.5">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{item.type === 'trago' ? 'T' : 'P'}</span>
                    <p className="text-sm font-medium text-zinc-100">{item.name}</p>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {item.salePrice ? `${formatARS(item.salePrice)} / u` : 'Sin precio'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(item.type, item.id, item.quantity - 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-zinc-400 hover:bg-zinc-700">−</button>
                  <span className="w-8 text-center text-sm font-medium text-zinc-100">{item.quantity}</span>
                  <button onClick={() => updateQty(item.type, item.id, item.quantity + 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-zinc-400 hover:bg-zinc-700">+</button>
                  <button onClick={() => removeFromCart(item.type, item.id)} className="ml-1 text-xs text-zinc-600 hover:text-red-400">×</button>
                </div>
              </div>
            ))}
          </div>

          {/* Descuento + Total */}
          <div className="mt-3 border-t border-zinc-800 pt-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Subtotal</span>
              <span className="text-sm text-zinc-400">{formatARS(subtotal)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 shrink-0">Descuento $</span>
              <input
                type="number" min="0" step="1"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                placeholder="0"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-brand-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-400">Total</span>
              <span className="text-xl font-bold text-brand-400">{formatARS(total)}</span>
            </div>
          </div>

          {/* Medio de pago */}
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Medio de pago</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                    paymentMethod === method
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                  }`}
                >
                  {PAYMENT_LABELS[method]}
                </button>
              ))}
            </div>
          </div>

          {/* Cliente para factura */}
          <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Cliente (opcional)</p>
            {clienteSeleccionado ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-100">{clienteSeleccionado.nombre}</p>
                  <p className="text-xs text-zinc-500">
                    {clienteSeleccionado.cuit ? `CUIT: ${clienteSeleccionado.cuit}` : clienteSeleccionado.dni ? `DNI: ${clienteSeleccionado.dni}` : 'Sin documento'}
                  </p>
                </div>
                <button onClick={() => setClienteId(null)} className="text-xs text-zinc-600 hover:text-red-400 transition">
                  Quitar
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={clienteSearch}
                  onChange={(e) => { setClienteSearch(e.target.value); setShowClienteList(true) }}
                  onFocus={() => setShowClienteList(true)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-brand-500"
                />
                {showClienteList && clienteSearch && clientesFiltrados.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden">
                    {clientesFiltrados.slice(0, 6).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setClienteId(c.id); setClienteSearch(''); setShowClienteList(false) }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800 transition border-b border-zinc-800 last:border-0"
                      >
                        <span className="font-medium text-zinc-100">{c.nombre}</span>
                        {(c.cuit || c.dni) && (
                          <span className="ml-2 text-xs text-zinc-500">
                            {c.cuit ? `CUIT: ${c.cuit}` : `DNI: ${c.dni}`}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Factura */}
          <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3">
            {paymentMethod !== CASH ? (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-brand-400" />
                <p className="text-xs font-medium text-brand-400">
                  Se generara factura electronica automaticamente
                </p>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={facturaEfectivo}
                  onChange={(e) => setFacturaEfectivo(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-600 accent-brand-500"
                />
                <span className="text-xs text-zinc-400">Generar factura electronica</span>
              </label>
            )}
          </div>

          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas (opcional)"
            className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-brand-500"
          />

          {error && <p className="mt-3 rounded-lg border border-red-800/50 bg-red-900/30 px-3 py-2 text-sm text-red-400">{error}</p>}

          <Button type="button" onClick={handleSubmit} loading={saving} className="mt-3 w-full">
            Confirmar venta
          </Button>
        </div>
      )}

      {cart.length === 0 && (
        <p className="text-center text-sm text-zinc-600">Selecciona un trago o producto para empezar</p>
      )}
    </div>
  )
}
