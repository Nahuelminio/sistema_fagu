import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { MovementsResponse } from '../../types'
import Badge from '../../components/ui/Badge'

export default function MyMovements() {
  const [data, setData]       = useState<MovementsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<MovementsResponse>('/movements')
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex h-48 items-center justify-center text-zinc-500">Cargando...</div>

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-zinc-100">Mis movimientos de hoy</h1>

      {data?.movements.length === 0 && (
        <p className="py-8 text-center text-zinc-500">Sin movimientos hoy</p>
      )}

      <div className="flex flex-col gap-2">
        {data?.movements.map((m) => (
          <div key={m.id} className="flex items-start justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge label={m.type} color={m.type === 'INGRESO' ? 'green' : 'red'} />
                <p className="font-medium text-zinc-100">{m.product.name}</p>
              </div>
              <p className="text-xs text-zinc-500">
                {new Date(m.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </p>
              {m.notes && <p className="mt-0.5 text-xs text-zinc-600">{m.notes}</p>}
            </div>
            <p className="font-semibold text-zinc-100">{m.quantity} {m.product.unit}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
