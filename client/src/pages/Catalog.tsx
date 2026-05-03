import { useCatalog } from '../hooks/useCatalog'

export default function Catalog() {
  const { data, loading } = useCatalog()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <p className="text-gray-400">Cargando carta...</p>
      </div>
    )
  }

  const categories = data ? Object.entries(data.categories) : []

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero */}
      <div className="bg-gradient-to-b from-brand-700 to-gray-900 px-4 py-12 text-center">
        <div className="mb-2 text-5xl">🍺</div>
        <h1 className="text-3xl font-bold">Nuestra Carta</h1>
        <p className="mt-2 text-brand-100 text-sm">Productos disponibles ahora</p>
      </div>

      <div className="mx-auto max-w-lg px-4 pb-12">
        {categories.length === 0 ? (
          <p className="py-12 text-center text-gray-500">Sin productos disponibles en este momento</p>
        ) : (
          categories.map(([cat, products]) => (
            <div key={cat} className="mt-8">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-500">{cat}</h2>
              <div className="flex flex-col gap-2">
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-2xl bg-gray-800 px-5 py-4"
                  >
                    <div>
                      <p className="font-semibold text-white">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.unit}</p>
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

        <p className="mt-10 text-center text-xs text-gray-600">
          Actualizado: {data ? new Date(data.updatedAt).toLocaleTimeString('es-AR') : '—'}
        </p>
      </div>
    </div>
  )
}
