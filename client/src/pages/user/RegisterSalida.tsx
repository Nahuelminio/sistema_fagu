import { useEffect, useState, FormEvent } from 'react'
import api from '../../lib/api'
import { Product } from '../../types'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import SearchableSelect, { SearchOption } from '../../components/ui/SearchableSelect'
import { useToast } from '../../context/ToastContext'


export default function RegisterSalida() {
  const { showToast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<Product[]>('/products').then((r) => setProducts(r.data))
  }, [])

  const selected = products.find((p) => p.id === parseInt(productId))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.post('/movements/salida', {
        productId: parseInt(productId),
        quantity: parseFloat(quantity),
        notes: notes || undefined,
      })
      showToast(`Salida de ${quantity} ${selected?.unit ?? ''} registrada`)
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
      <h1 className="text-xl font-bold text-zinc-100">Registrar salida</h1>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-col gap-4">
          <SearchableSelect
            label="Producto"
            value={productId}
            onChange={setProductId}
            placeholder="Buscar producto..."
            options={products.map<SearchOption>((p) => ({
              value: String(p.id),
              label: p.name,
              meta:  `${p.currentStock} ${p.unit}`,
            }))}
          />

          <Input label="Cantidad" type="number" step="0.001" min="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          <Input label="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

          {error && <p className="rounded-lg border border-red-800/50 bg-red-900/30 px-3 py-2 text-sm text-red-400">{error}</p>}

          <Button type="submit" loading={saving} className="w-full">Registrar salida</Button>
        </div>
      </form>
    </div>
  )
}
