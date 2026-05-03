import { useEffect, useState, FormEvent } from 'react'
import api from '../../lib/api'
import { Product } from '../../types'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

export default function RegisterSalida() {
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<Product[]>('/products').then((r) => setProducts(r.data))
  }, [])

  const selected = products.find((p) => p.id === parseInt(productId))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      await api.post('/movements/salida', {
        productId: parseInt(productId),
        quantity: parseFloat(quantity),
        notes: notes || undefined,
      })
      setSuccess(`Salida de ${quantity} ${selected?.unit} registrada`)
      setQuantity('')
      setNotes('')
      api.get<Product[]>('/products').then((r) => setProducts(r.data))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Error al registrar la salida')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-gray-900">Registrar salida</h1>

      <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Producto</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            >
              <option value="">Seleccionar...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.currentStock} {p.unit})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Cantidad"
            type="number"
            step="0.001"
            min="0.001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />

          <Input
            label="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          {success && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

          <Button type="submit" loading={saving} className="w-full">
            Registrar salida
          </Button>
        </div>
      </form>
    </div>
  )
}
