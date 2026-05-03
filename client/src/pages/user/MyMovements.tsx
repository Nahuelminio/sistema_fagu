import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { MovementsResponse } from '../../types'
import Badge from '../../components/ui/Badge'

export default function MyMovements() {
  const [data, setData] = useState<MovementsResponse | null>(null)

  useEffect(() => {
    api.get<MovementsResponse>('/movements').then((r) => setData(r.data))
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-gray-900">Mis movimientos de hoy</h1>

      {data?.movements.length === 0 && (
        <p className="text-center text-gray-400 py-8">Sin movimientos hoy</p>
      )}

      <div className="flex flex-col gap-2">
        {data?.movements.map((m) => (
          <div key={m.id} className="flex items-start justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <Badge label={m.type} color={m.type === 'INGRESO' ? 'green' : 'red'} />
                <p className="font-medium text-gray-900">{m.product.name}</p>
              </div>
              <p className="text-xs text-gray-500">{new Date(m.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
              {m.notes && <p className="mt-0.5 text-xs text-gray-400">{m.notes}</p>}
            </div>
            <p className="font-semibold text-gray-900">{m.quantity} {m.product.unit}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
