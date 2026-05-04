import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { DashboardData } from '../../types'
import Badge from '../../components/ui/Badge'

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-zinc-100">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
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

  if (!data) return <p className="text-center text-zinc-500">Cargando...</p>

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-zinc-100">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Productos" value={data.totalProducts} />
        <StatCard label="Ventas hoy" value={data.todayVentas} />
        <StatCard label="Compras del mes" value={formatARS(data.month.costoCompras)} />
        <StatCard label="Ventas del mes" value={formatARS(data.month.ventas)} />
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Ganancia del mes</p>
        <p className={`mt-1 text-3xl font-bold ${data.month.ganancia >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {formatARS(data.month.ganancia)}
        </p>
      </div>

      {data.lowStockProducts.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 font-semibold text-zinc-300">
            <span>⚠️</span> Bajo stock mínimo
          </h2>
          {data.lowStockProducts.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3">
              <div>
                <p className="font-medium text-zinc-100">{p.name}</p>
                <p className="text-xs text-zinc-500">{p.category.name}</p>
              </div>
              <div className="text-right">
                <Badge label={`${p.currentStock} ${p.unit}`} color="red" />
                <p className="mt-0.5 text-xs text-zinc-600">mín: {p.minStock}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
