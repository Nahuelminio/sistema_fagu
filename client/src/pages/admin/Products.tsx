import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { Product, Category } from '../../types'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'

const emptyForm = {
  name: '', categoryId: '', unit: '', minStock: '0',
  costPrice: '', salePrice: '', visibleInCatalog: false,
}

const selectClass = 'w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-brand-500'

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    load()
    api.get<Category[]>('/categories').then((r) => setCategories(r.data))
  }, [])

  async function load() {
    const { data } = await api.get<Product[]>('/products')
    setProducts(data)
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      name: p.name,
      categoryId: String(p.category.id),
      unit: p.unit,
      minStock: p.minStock,
      costPrice: p.costPrice ?? '',
      salePrice: p.salePrice ?? '',
      visibleInCatalog: p.visibleInCatalog,
    })
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    const body = {
      name: form.name,
      categoryId: parseInt(form.categoryId),
      unit: form.unit,
      minStock: parseFloat(form.minStock),
      costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
      salePrice: form.salePrice ? parseFloat(form.salePrice) : undefined,
      visibleInCatalog: form.visibleInCatalog,
    }
    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, body)
      } else {
        await api.post('/products', body)
      }
      setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este producto?')) return
    await api.delete(`/products/${id}`)
    load()
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.name.toLowerCase().includes(search.toLowerCase())
  )

  const stockColor = (p: Product) =>
    Number(p.currentStock) <= Number(p.minStock) ? 'red' : 'green'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">Productos</h1>
        <Button onClick={openCreate}>+ Nuevo</Button>
      </div>

      <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {showForm && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-4 font-semibold text-zinc-100">{editing ? 'Editar producto' : 'Nuevo producto'}</h2>
          <div className="flex flex-col gap-3">
            <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-400">Categoría</label>
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className={selectClass}>
                <option value="">Seleccionar...</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Input label="Unidad" placeholder="unidades, litros, kg..." value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            <Input label="Stock mínimo" type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Precio costo" type="number" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
              <Input label="Precio venta" type="number" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={form.visibleInCatalog}
                onChange={(e) => setForm({ ...form, visibleInCatalog: e.target.checked })}
                className="accent-brand-500"
              />
              Visible en catálogo público
            </label>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} loading={saving}>Guardar</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((p) => (
          <div key={p.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-zinc-100">{p.name}</p>
                  {p.visibleInCatalog && <Badge label="Catálogo" color="orange" />}
                </div>
                <p className="text-xs text-zinc-500">{p.category.name} · {p.unit}</p>
                <div className="mt-2 flex items-center gap-3">
                  <Badge label={`Stock: ${p.currentStock}`} color={stockColor(p)} />
                  <span className="text-xs text-zinc-600">mín {p.minStock}</span>
                </div>
                {(p.costPrice || p.salePrice) && (
                  <div className="mt-1 flex gap-3 text-xs text-zinc-500">
                    {p.costPrice && <span>Costo: ${p.costPrice}</span>}
                    {p.salePrice && <span className="text-brand-400">Venta: ${p.salePrice}</span>}
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(p)} className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300">✏️</button>
                <button onClick={() => handleDelete(p.id)} className="rounded-lg p-2 text-zinc-600 hover:bg-red-950/50 hover:text-red-400">🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
