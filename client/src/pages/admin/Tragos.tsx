import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { Trago, Product } from '../../types'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'

const selectClass = 'w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-brand-500'

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

interface IngForm { productId: string; cantidad: string }

export default function Tragos() {
  const [tragos, setTragos]       = useState<Trago[]>([])
  const [products, setProducts]   = useState<Product[]>([])
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<Trago | null>(null)
  const [name, setName]           = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [ings, setIngs]           = useState<IngForm[]>([{ productId: '', cantidad: '' }])
  const [saving, setSaving]       = useState(false)

  useEffect(() => { load(); loadProducts() }, [])

  async function load() {
    const { data } = await api.get<Trago[]>('/tragos')
    setTragos(data)
  }
  async function loadProducts() {
    const { data } = await api.get<Product[]>('/products')
    setProducts(data)
  }

  function openCreate() {
    setEditing(null)
    setName('')
    setSalePrice('')
    setIngs([{ productId: '', cantidad: '' }])
    setShowForm(true)
  }

  function openEdit(t: Trago) {
    setEditing(t)
    setName(t.name)
    setSalePrice(t.salePrice ?? '')
    setIngs(t.ingredientes.map((i) => ({ productId: String(i.productId), cantidad: String(i.cantidad) })))
    setShowForm(true)
  }

  function addIng() { setIngs((prev) => [...prev, { productId: '', cantidad: '' }]) }
  function removeIng(i: number) { setIngs((prev) => prev.filter((_, idx) => idx !== i)) }
  function updateIng(i: number, field: keyof IngForm, val: string) {
    setIngs((prev) => prev.map((ing, idx) => idx === i ? { ...ing, [field]: val } : ing))
  }

  async function handleSave() {
    setSaving(true)
    const body = {
      name,
      salePrice: salePrice ? parseFloat(salePrice) : undefined,
      ingredientes: ings
        .filter((i) => i.productId && i.cantidad)
        .map((i) => ({ productId: parseInt(i.productId), cantidad: parseFloat(i.cantidad) })),
    }
    try {
      if (editing) {
        await api.put(`/tragos/${editing.id}`, body)
      } else {
        await api.post('/tragos', body)
      }
      setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este trago?')) return
    await api.delete(`/tragos/${id}`)
    load()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">Tragos</h1>
        <Button onClick={openCreate}>+ Nuevo</Button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-4 font-semibold text-zinc-100">{editing ? 'Editar trago' : 'Nuevo trago'}</h2>
          <div className="flex flex-col gap-3">
            <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Gin Tonic..." />
            <Input label="Precio de venta" type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="0" />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Ingredientes</label>
                <button onClick={addIng} className="text-xs text-brand-400 hover:text-brand-300">+ Agregar</button>
              </div>
              <div className="flex flex-col gap-2">
                {ings.map((ing, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={ing.productId}
                      onChange={(e) => updateIng(i, 'productId', e.target.value)}
                      className={`${selectClass} flex-1`}
                    >
                      <option value="">Seleccionar...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={ing.cantidad}
                      onChange={(e) => updateIng(i, 'cantidad', e.target.value)}
                      placeholder="Cant."
                      className="w-20 rounded-xl border border-zinc-700 bg-zinc-800 px-2 py-2.5 text-sm text-zinc-100 outline-none focus:border-brand-500"
                    />
                    {ings.length > 1 && (
                      <button onClick={() => removeIng(i)} className="text-zinc-600 hover:text-red-400">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} loading={saving}>Guardar</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {tragos.map((t) => (
          <div key={t.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base">🍹</span>
                  <p className="font-semibold text-zinc-100">{t.name}</p>
                  {t.salePrice && (
                    <span className="text-sm font-bold text-brand-400">{formatARS(Number(t.salePrice))}</span>
                  )}
                  {!t.active && <Badge label="Inactivo" color="red" />}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.ingredientes.map((ing) => (
                    <span key={ing.id} className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                      {ing.product.name} {ing.cantidad} {ing.product.unit}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1 ml-2">
                <button onClick={() => openEdit(t)} className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300">✏️</button>
                <button onClick={() => handleDelete(t.id)} className="rounded-lg p-2 text-zinc-600 hover:bg-red-950/50 hover:text-red-400">🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
