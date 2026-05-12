import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { Product } from '../../types'
import Input from '../../components/ui/Input'

export default function StockView() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    api.get<Product[]>('/products')
      .then((r) => setProducts(r.data))
      .catch(() => {/* silencioso — el usuario ve lista vacía */})
      .finally(() => setLoading(false))
  }, [])

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="flex h-48 items-center justify-center text-zinc-500">Cargando...</div>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">Stock actual</h1>
        <span className="text-xs text-zinc-600">{filtered.length} productos</span>
      </div>
      <Input placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {filtered.map((p) => {
          const low = Number(p.currentStock) <= Number(p.minStock)
          return (
            <div
              key={p.id}
              className={`rounded-xl border px-3 py-3 flex flex-col gap-1 ${
                low ? 'border-red-900/50 bg-red-950/20' : 'border-zinc-800 bg-zinc-900'
              }`}
            >
              <p className="text-sm font-semibold text-zinc-100 leading-tight">{p.name}</p>
              <p className="text-xs text-zinc-500">{p.category.name}</p>
              <div className="mt-1 flex items-end justify-between gap-1">
                <span className={`text-lg font-bold leading-none ${low ? 'text-red-400' : 'text-brand-400'}`}>
                  {Number(p.currentStock).toFixed(Number(p.currentStock) % 1 === 0 ? 0 : 2)}
                </span>
                <span className="text-xs text-zinc-500">{p.unit}</span>
              </div>
              {low && <p className="text-xs text-red-500 font-medium">Bajo mínimo</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
