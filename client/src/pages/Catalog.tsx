import { useCatalog } from '../hooks/useCatalog'

export default function Catalog() {
  const { data, loading } = useCatalog()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-zinc-500">Cargando carta...</p>
      </div>
    )
  }

  const categories = data ? Object.entries(data.categories) : []

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Hero */}
      <div className="px-4 py-14 text-center">
        <div className="mb-3 text-5xl font-black tracking-widest text-zinc-100">
          <span className="text-brand-500">⚡</span> FAGU
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-zinc-500">Drink Bar</p>
        <p className="mt-4 text-sm text-zinc-400">Carta disponible ahora</p>
        <div className="mx-auto mt-4 h-px w-16 bg-brand-600" />
      </div>

      <div className="mx-auto max-w-lg px-4 pb-16">
        {categories.length === 0 ? (
          <p className="py-12 text-center text-zinc-600">Sin productos disponibles en este momento</p>
        ) : (
          categories.map(([cat, products]) => (
            <div key={cat} className="mt-8">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-500">{cat}</h2>
              <div className="flex flex-col gap-2">
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4"
                  >
                    <div>
                      <p className="font-semibold text-zinc-100">{p.name}</p>
                      <p className="text-xs text-zinc-500">{p.unit}</p>
                    </div>
                    {p.salePrice && (
                      <p className="text-xl font-bold text-brand-400">
                        ${Number(p.salePrice).toLocaleString('es-AR')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        <p className="mt-12 text-center text-xs text-zinc-700">
          Actualizado: {data ? new Date(data.updatedAt).toLocaleTimeString('es-AR') : '—'}
        </p>
      </div>
    </div>
  )
}
