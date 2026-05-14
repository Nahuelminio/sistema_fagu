import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { Product, Trago, PaymentMethod, PAYMENT_LABELS } from '../../types'
import Button from '../../components/ui/Button'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'

interface Cliente {
  id: number
  nombre: string
  cuit?: string | null
  dni?: string | null
  email?: string | null
}

interface ComandaItem {
  id: number
  productId: number | null
  tragoId: number | null
  nombre: string
  quantity: string
  unitPrice: string
}

interface Comanda {
  id: number
  mesaId: number
  status: 'ABIERTA' | 'CERRADA'
  items: ComandaItem[]
}

interface Mesa {
  id: number
  numero: number
  nombre: string | null
  status: 'ABIERTA' | 'CERRADA'
  comandas: Comanda[]
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

const selectClass = 'w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-brand-500'

// ── Vista de comanda activa ───────────────────────────────────────────────────
function ComandaView({
  mesa, comanda, onClose, onBack
}: {
  mesa: Mesa, comanda: Comanda
  onClose: (saleId: number, total: number) => void
  onBack: () => void
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [tragos, setTragos]     = useState<Trago[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [tab, setTab]           = useState<'trago' | 'product'>('trago')
  const [selectedId, setSelectedId] = useState('')
  const [quantity, setQuantity]     = useState('1')
  const [currentComanda, setCurrentComanda] = useState<Comanda>(comanda)
  const [paymentMethod, setPaymentMethod]   = useState<PaymentMethod>('EFECTIVO')
  const [discount, setDiscount] = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  // Cliente + factura
  const [clienteId, setClienteId]           = useState<number | null>(null)
  const [clienteSearch, setClienteSearch]   = useState('')
  const [showClienteList, setShowClienteList] = useState(false)
  const [generarFactura, setGenerarFactura] = useState(false)

  useEffect(() => {
    api.get<Product[]>('/products').then((r) => setProducts(r.data)).catch(() => {})
    api.get<Trago[]>('/tragos').then((r) => setTragos(r.data)).catch(() => {})
    api.get<Cliente[]>('/clientes').then((r) => setClientes(r.data)).catch(() => {})
  }, [])

  const clienteSeleccionado = clientes.find((c) => c.id === clienteId) ?? null
  const filteredClientes = clientes.filter((c) => {
    const q = clienteSearch.toLowerCase().trim()
    if (!q) return true
    return c.nombre.toLowerCase().includes(q)
      || c.cuit?.includes(q)
      || c.dni?.includes(q)
  }).slice(0, 6)

  const debeFacturar = paymentMethod !== 'EFECTIVO' || generarFactura

  const availableProducts = products.filter((p) => Number(p.currentStock) > 0)
  const availableTragos   = tragos.filter((t) => t.active)

  async function addItem() {
    const qty = parseFloat(quantity)
    if (!selectedId || !qty || qty <= 0) return
    try {
      const type = tab === 'product' ? 'product' : 'trago'
      const res = await api.post<Comanda>(`/mesas/comanda/${currentComanda.id}/items`, {
        type, id: parseInt(selectedId), quantity: qty,
      })
      setCurrentComanda(res.data)
      setSelectedId('')
      setQuantity('1')
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al agregar')
    }
  }

  async function removeItem(itemId: number) {
    await api.delete(`/mesas/comanda/${currentComanda.id}/items/${itemId}`)
    setCurrentComanda((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== itemId) }))
  }

  const subtotal     = currentComanda.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0)
  const discountAmt  = parseFloat(discount) || 0
  const total        = Math.max(0, subtotal - discountAmt)

  async function handleClose() {
    setSaving(true)
    setError('')
    try {
      const res = await api.post<{ saleId: number; total: number }>(
        `/mesas/comanda/${currentComanda.id}/cerrar`,
        {
          paymentMethod,
          discount: discountAmt,
          ...(clienteId ? { clienteId } : {}),
          ...(paymentMethod === 'EFECTIVO' ? { generarFactura } : {}),
        }
      )
      onClose(res.data.saleId, res.data.total)
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al cerrar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-zinc-500 hover:text-zinc-300 text-sm transition">← Mesas</button>
        <span className="text-zinc-600">·</span>
        <span className="text-sm font-semibold text-zinc-100">Mesa {mesa.numero}{mesa.nombre ? ` — ${mesa.nombre}` : ''}</span>
      </div>

      {/* Agregar ítem */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-3 flex rounded-xl border border-zinc-800 bg-zinc-950 p-1">
          {(['trago', 'product'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelectedId('') }}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${tab === t ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {t === 'trago' ? 'Tragos' : 'Productos'}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={selectClass}>
            <option value="">{tab === 'trago' ? 'Seleccionar trago...' : 'Seleccionar producto...'}</option>
            {tab === 'trago'
              ? availableTragos.map((t) => <option key={t.id} value={t.id}>{t.name}{t.salePrice ? ` — ${formatARS(Number(t.salePrice))}` : ''}</option>)
              : availableProducts.map((p) => <option key={p.id} value={p.id}>{p.name} — stock: {p.currentStock} {p.unit}{p.salePrice ? ` — ${formatARS(Number(p.salePrice))}` : ''}</option>)
            }
          </select>
          <div className="flex gap-2">
            <input
              type="number" step="1" min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-20 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none"
            />
            <Button type="button" onClick={addItem} disabled={!selectedId} className="flex-1">+ Agregar</Button>
          </div>
        </div>
      </div>

      {/* Items en comanda */}
      {currentComanda.items.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Comanda</p>
          <div className="flex flex-col divide-y divide-zinc-800">
            {currentComanda.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-zinc-100">{item.nombre}</p>
                  <p className="text-xs text-zinc-500">{formatARS(Number(item.unitPrice))} × {Number(item.quantity)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-zinc-300">{formatARS(Number(item.unitPrice) * Number(item.quantity))}</span>
                  <button onClick={() => removeItem(item.id)} className="text-xs text-zinc-600 hover:text-red-400">×</button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 border-t border-zinc-800 pt-3 flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Subtotal</span>
              <span className="text-zinc-400">{formatARS(subtotal)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 shrink-0">Descuento $</span>
              <input
                type="number" min="0" value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none"
              />
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-zinc-400">Total</span>
              <span className="text-xl font-bold text-brand-400">{formatARS(total)}</span>
            </div>
          </div>

          <div className="mt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Medio de pago</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((method) => (
                <button
                  key={method}
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

          {/* Cliente (opcional, para factura personalizada) */}
          <div className="mt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Cliente (opcional)</p>
            {clienteSeleccionado ? (
              <div className="flex items-center justify-between rounded-xl border border-brand-500/30 bg-brand-500/5 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{clienteSeleccionado.nombre}</p>
                  {(clienteSeleccionado.cuit || clienteSeleccionado.dni) && (
                    <p className="text-xs text-zinc-500">
                      {clienteSeleccionado.cuit ? `CUIT ${clienteSeleccionado.cuit}` : `DNI ${clienteSeleccionado.dni}`}
                      {clienteSeleccionado.email && ` · ${clienteSeleccionado.email}`}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { setClienteId(null); setClienteSearch('') }}
                  className="text-xs text-zinc-500 hover:text-red-400 transition"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar por nombre, CUIT o DNI..."
                  value={clienteSearch}
                  onChange={(e) => { setClienteSearch(e.target.value); setShowClienteList(true) }}
                  onFocus={() => setShowClienteList(true)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500"
                />
                {showClienteList && filteredClientes.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl">
                    {filteredClientes.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setClienteId(c.id)
                          setClienteSearch('')
                          setShowClienteList(false)
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800 transition"
                      >
                        <p className="font-medium">{c.nombre}</p>
                        {(c.cuit || c.dni) && (
                          <p className="text-xs text-zinc-500">
                            {c.cuit ? `CUIT ${c.cuit}` : `DNI ${c.dni}`}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Factura */}
          <div className="mt-3">
            {paymentMethod !== 'EFECTIVO' ? (
              <div className="flex items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/5 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-brand-400" />
                <p className="text-xs text-zinc-300">Se generará factura automáticamente</p>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generarFactura}
                  onChange={(e) => setGenerarFactura(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-brand-500"
                />
                <span className="text-xs text-zinc-300">Generar factura</span>
              </label>
            )}
          </div>

          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          <Button type="button" onClick={handleClose} loading={saving} className="mt-3 w-full">
            {debeFacturar ? 'Cobrar y facturar' : 'Cerrar y cobrar'}
          </Button>
        </div>
      )}

      {currentComanda.items.length === 0 && (
        <p className="text-center text-sm text-zinc-600">Agregá ítems a la comanda</p>
      )}
    </div>
  )
}

// ── Vista principal de mesas ──────────────────────────────────────────────────
export default function Mesas() {
  const { showToast } = useToast()
  const confirm = useConfirm()
  const [mesas, setMesas]           = useState<Mesa[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeMesa, setActiveMesa] = useState<Mesa | null>(null)
  const [activeComanda, setActiveComanda] = useState<Comanda | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newNumero, setNewNumero]   = useState('')
  const [newNombre, setNewNombre]   = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<Mesa[]>('/mesas')
      setMesas(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function getNextNumero(): number {
    // Auto-incremento: tomamos el máximo número existente + 1 (o 1 si no hay ninguno)
    if (mesas.length === 0) return 1
    return Math.max(...mesas.map((m) => m.numero)) + 1
  }

  async function handleCreateMesa() {
    const numero = newNumero ? parseInt(newNumero) : getNextNumero()
    try {
      await api.post('/mesas', { numero, nombre: newNombre || undefined })
      setNewNumero('')
      setNewNombre('')
      setShowCreate(false)
      load()
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? 'Error al crear la cuenta', 'error')
    }
  }

  function openCreate() {
    setNewNumero(String(getNextNumero()))
    setNewNombre('')
    setShowCreate(true)
  }

  async function handleDeleteMesa(id: number) {
    const ok = await confirm({
      title: 'Eliminar cuenta',
      message: '¿Eliminar esta cuenta? Se borra el historial de comandas asociadas.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/mesas/${id}`)
      load()
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? 'Error al eliminar la cuenta', 'error')
    }
  }

  async function handleOpenMesa(mesa: Mesa) {
    // Si hay comanda abierta, usarla. Si no, crear una nueva.
    const existing = mesa.comandas.find((c) => c.status === 'ABIERTA')
    if (existing) {
      setActiveMesa(mesa)
      setActiveComanda(existing)
    } else {
      const res = await api.post<Comanda>(`/mesas/${mesa.id}/comanda`, {})
      setActiveMesa(mesa)
      setActiveComanda(res.data)
    }
  }

  function handleComandaClosed(saleId: number, total: number) {
    showToast(`Venta #${saleId} registrada — ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(total)}`)
    setActiveMesa(null)
    setActiveComanda(null)
    load()
  }

  if (activeMesa && activeComanda) {
    return (
      <ComandaView
        mesa={activeMesa}
        comanda={activeComanda}
        onClose={handleComandaClosed}
        onBack={() => { setActiveMesa(null); setActiveComanda(null); load() }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Cuentas abiertas</h1>
          <p className="text-xs text-zinc-500">Mesas o clientes con cuenta pendiente</p>
        </div>
        <button
          onClick={() => showCreate ? setShowCreate(false) : openCreate()}
          className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-400 transition"
        >
          + Nueva cuenta
        </button>
      </div>


      {showCreate && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-zinc-300">Nueva cuenta</p>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number" placeholder="N°" value={newNumero}
              onChange={(e) => setNewNumero(e.target.value)}
              className="col-span-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none"
            />
            <input
              type="text" placeholder="Nombre (ej: Juan, Mesa de la ventana...)" value={newNombre}
              onChange={(e) => setNewNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateMesa() }}
              autoFocus
              className="col-span-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={handleCreateMesa} disabled={!newNumero}>Abrir cuenta</Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center text-sm text-zinc-500">Cargando...</p>
      ) : mesas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center">
          <p className="text-sm text-zinc-400">No hay cuentas abiertas</p>
          <p className="mt-1 text-xs text-zinc-600">Tocá "Nueva cuenta" para abrir una</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {mesas.map((mesa) => {
            const comanda = mesa.comandas.find((c) => c.status === 'ABIERTA')
            const itemCount = comanda?.items.length ?? 0
            const subtotal  = comanda?.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0) ?? 0

            return (
              <div
                key={mesa.id}
                className={`rounded-2xl border p-4 flex flex-col gap-2 cursor-pointer transition ${
                  comanda
                    ? 'border-brand-600 bg-brand-900/20 hover:border-brand-400'
                    : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                }`}
                onClick={() => handleOpenMesa(mesa)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-lg font-bold text-zinc-100">#{mesa.numero}</p>
                    {mesa.nombre && <p className="text-xs text-zinc-500">{mesa.nombre}</p>}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteMesa(mesa.id) }}
                    className="text-xs text-zinc-700 hover:text-red-400 transition"
                  >×</button>
                </div>

                {comanda ? (
                  <div>
                    <span className="inline-block rounded-full bg-brand-500/20 px-2 py-0.5 text-xs font-semibold text-brand-300">
                      {itemCount} {itemCount === 1 ? 'ítem' : 'ítems'}
                    </span>
                    {subtotal > 0 && (
                      <p className="mt-1 text-sm font-bold text-brand-400">
                        {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(subtotal)}
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-zinc-600">Libre</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
