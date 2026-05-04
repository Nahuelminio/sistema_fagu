import { useEffect, useState } from 'react'
import api from '../lib/api'
import { Product, PaymentMethod, PAYMENT_LABELS } from '../types'
import Button from '../components/ui/Button'

interface CartItem {
  product: Product
  quantity: number
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)
}

export default function RegisterVenta() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<Product[]>('/products').then((r) => setProducts(r.data))
  }, [])

  const selectedProduct = products.find((p) => p.id === parseInt(selectedId))

  function addToCart() {
    if (!selectedProduct) return
    const qty = parseFloat(quantity)
    if (!qty || qty <= 0) return

    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === selectedProduct.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === selectedProduct.id
            ? { ...i, quantity: i.quantity + qty }
            : i
        )
      }
      return [...prev, { product: selectedProduct, quantity: qty }]
    })
    setSelectedId('')
    setQuantity('1')
  }

  function removeFromCart(productId: number) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId))
  }

  function updateQty(productId: number, qty: number) {
    if (qty <= 0) {
      removeFromCart(productId)
      return
    }
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i))
    )
  }

  const total = cart.reduce(
    (sum, i) => sum + Number(i.product.salePrice ?? 0) * i.quantity,
    0
  )

  async function handleSubmit() {
    if (cart.length === 0) return
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const res = await api.post('/ventas', {
        items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        paymentMethod,
        notes: notes || undefined,
      })
      setSuccess(`Venta #${res.data.id} registrada por ${formatARS(Number(res.data.total))}`)
      setCart([])
      setPaymentMethod('EFECTIVO')
      setNotes('')
      api.get<Product[]>('/products').then((r) => setProducts(r.data))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Error al registrar la venta')
    } finally {
      setSaving(false)
    }
  }

  // Productos no repetidos en carrito con stock > 0
  const availableProducts = products.filter(
    (p) =>
      Number(p.currentStock) > 0 &&
      !cart.some((i) => i.product.id === p.id)
  )

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-gray-900">Registrar venta</h1>

      {/* Agregar producto */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-gray-700">Agregar producto</p>
        <div className="flex flex-col gap-3">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          >
            <option value="">Seleccionar producto...</option>
            {availableProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — stock: {p.currentStock} {p.unit}
                {p.salePrice ? ` — ${formatARS(Number(p.salePrice))}` : ''}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Cantidad"
              className="w-28 rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            />
            <Button
              type="button"
              onClick={addToCart}
              disabled={!selectedProduct}
              className="flex-1"
            >
              + Agregar
            </Button>
          </div>
        </div>
      </div>

      {/* Carrito */}
      {cart.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-gray-700">Carrito</p>
          <div className="flex flex-col divide-y divide-gray-100">
            {cart.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{item.product.name}</p>
                  <p className="text-xs text-gray-400">
                    {item.product.salePrice
                      ? `${formatARS(Number(item.product.salePrice))} / ${item.product.unit}`
                      : 'Sin precio'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQty(item.product.id, item.quantity - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-200"
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-sm font-medium">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQty(item.product.id, item.quantity + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-200"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="ml-1 text-xs text-red-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="text-sm font-semibold text-gray-700">Total</span>
            <span className="text-lg font-bold text-brand-600">{formatARS(total)}</span>
          </div>

          {/* Medio de pago */}
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-gray-500">Medio de pago</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                    paymentMethod === method
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {PAYMENT_LABELS[method]}
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas (opcional)"
            className="mt-3 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          />

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          {success && (
            <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              ✓ {success}
            </p>
          )}

          <Button
            type="button"
            onClick={handleSubmit}
            loading={saving}
            className="mt-3 w-full"
          >
            Confirmar venta
          </Button>
        </div>
      )}

      {cart.length === 0 && !success && (
        <p className="text-center text-sm text-gray-400">
          Agregá productos al carrito para registrar una venta
        </p>
      )}
    </div>
  )
}
