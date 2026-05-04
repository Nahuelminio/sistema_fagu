import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { DashboardData } from '../../types'
import Badge from '../../components/ui/Badge'

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    api.get<DashboardData>('/dashboard').then((r) => setData(r.data))
  }, [])

  if (!data) return <p className="text-center text-gray-400">Cargando...</p>

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Productos" value={data.totalProducts} />
        <StatCard label="Ventas hoy" value={data.todayVentas} />
        <StatCard label="Compras del mes" value={formatARS(data.month.costoCompras)} />
        <StatCard label="Ventas del mes" value={formatARS(data.month.ventas)} />
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Ganancia del mes</p>
        <p className={`mt-1 text-3xl font-bold ${data.month.ganancia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatARS(data.month.ganancia)}
        </p>
      </div>

      {data.lowStockProducts.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 font-semibold text-gray-800">
            <span>⚠️</span> Bajo stock mínimo
          </h2>
          {data.lowStockProducts.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3">
              <div>
                <p className="font-medium text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-500">{p.category.name}</p>
              </div>
              <div className="text-right">
                <Badge label={`${p.currentStock} ${p.unit}`} color="red" />
                <p className="mt-0.5 text-xs text-gray-400">mín: {p.minStock}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
