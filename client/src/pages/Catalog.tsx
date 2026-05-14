import { useMemo, useState } from 'react'
import { useCatalog } from '../hooks/useCatalog'
import { CatalogItem } from '../types'

const formatARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

export default function Catalog() {
  const { data, loading } = useCatalog()
  const [search, setSearch]       = useState('')
  const [activeCat, setActiveCat] = useState<string>('TODO')

  const categories = useMemo(() => data ? Object.entries(data.categories) : [], [data])

  // Filtrado: por categoría + búsqueda
  const filtered = useMemo(() => {
    if (!data) return [] as [string, CatalogItem[]][]
    const q = search.toLowerCase().trim()
    return Object.entries(data.categories)
      .filter(([cat]) => activeCat === 'TODO' || activeCat === cat)
      .map(([cat, items]): [string, CatalogItem[]] => {
        if (!q) return [cat, items]
        const matched = items.filter((i) =>
          i.name.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q)
        )
        return [cat, matched]
      })
      .filter(([, items]) => items.length > 0)
  }, [data, search, activeCat])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-zinc-500">Cargando carta...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Hero */}
      <div className="relative px-4 py-12 text-center overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950">
        {/* Decoración sutil */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_0%,rgba(167,139,250,0.3),transparent_50%)]" />

        <div className="relative">
          <img
            src="/logo.png"
            alt="FAGU Drink Bar"
            className="mx-auto mb-3 h-28 w-28 rounded-full object-cover ring-2 ring-zinc-800"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <h1 className="text-3xl font-black tracking-widest text-zinc-100">FAGU</h1>
          <p className="mt-1 text-xs font-semibold tracking-[0.4em] uppercase text-brand-400">Drink Bar</p>
          <p className="mt-5 text-sm text-zinc-400">Nuestra carta</p>
          <div className="mx-auto mt-3 h-px w-20 bg-gradient-to-r from-transparent via-brand-500 to-transparent" />
        </div>
      </div>

      {/* Sticky header con búsqueda y tabs */}
      <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-brand-500 placeholder:text-zinc-600"
          />

          {/* Tabs/chips de categorías */}
          {categories.length > 1 && (
            <div className="mt-3 -mx-4 overflow-x-auto scrollbar-none">
              <div className="flex gap-2 px-4 min-w-max">
                <button
                  onClick={() => setActiveCat('TODO')}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                    activeCat === 'TODO'
                      ? 'bg-brand-500 text-white'
                      : 'border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Todo
                </button>
                {categories.map(([cat]) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCat(cat)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                      activeCat === cat
                        ? 'bg-brand-500 text-white'
                        : 'border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="mx-auto max-w-2xl px-4 pb-16">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-zinc-600">
              {search ? `Sin resultados para "${search}"` : 'Sin productos disponibles'}
            </p>
          </div>
        ) : (
          filtered.map(([cat, items]) => (
            <section key={cat} id={`cat-${cat}`} className="mt-8 first:mt-6">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-500">{cat}</h2>
              <div className="flex flex-col gap-2">
                {items.map((item) => (
                  <ItemCard key={`${item.type}_${item.id}`} item={item} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 px-4 py-8 text-center">
        <p className="text-sm font-semibold text-zinc-300">FAGU Drink Bar</p>
        <p className="mt-1 text-xs text-zinc-500">Los Girasoles 10688 — Posadas, Misiones</p>
        <p className="mt-4 text-[10px] text-zinc-700">
          Actualizado: {data ? new Date(data.updatedAt).toLocaleTimeString('es-AR') : '—'}
        </p>
      </footer>
    </div>
  )
}

function ItemCard({ item }: { item: CatalogItem }) {
  const hasImage = !!item.imageUrl
  return (
    <div className={`flex rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden ${hasImage ? 'min-h-[88px]' : ''}`}>
      {hasImage && (
        <img
          src={item.imageUrl!}
          alt={item.name}
          className="h-auto w-24 sm:w-28 object-cover shrink-0"
          onError={(e) => { (e.currentTarget.style.display = 'none') }}
        />
      )}
      <div className="flex flex-1 items-center justify-between px-4 py-3 gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-zinc-100">{item.name}</p>
          {item.description && (
            <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">{item.description}</p>
          )}
          {!item.description && item.unit && (
            <p className="text-xs text-zinc-600">{item.unit}</p>
          )}
        </div>
        {item.salePrice && (
          <p className="text-lg font-bold text-brand-400 shrink-0">
            {formatARS(Number(item.salePrice))}
          </p>
        )}
      </div>
    </div>
  )
}
