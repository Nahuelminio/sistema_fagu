import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { Product } from '../../types'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'

export default function StockView() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get<Product[]>('/products').then((r) => setProducts(r.data))
  }, [])

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const stockBadge = (p: Product) =>
    Number(p.currentStock) <= Number(p.minStock) ? 'red' : 'green'

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-gray-900">Stock actual</h1>
      <Input placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="flex flex-col gap-2">
        {filtered.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="font-medium text-gray-900">{p.name}</p>
              <p className="text-xs text-gray-500">{p.category.name} · {p.unit}</p>
            </div>
            <div className="text-right">
              <Badge label={`${p.currentStock} ${p.unit}`} color={stockBadge(p)} />
              {Number(p.currentStock) <= Number(p.minStock) && (
                <p className="mt-0.5 text-xs text-red-500">Bajo mínimo</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
