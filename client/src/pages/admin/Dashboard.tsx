import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import { BotellaActiva } from '../../types'

interface WeekDay { date: string; revenue: number; count: number }
interface TopItem  { nombre: string; qty: number; revenue: number }
interface PayMethod { method: string; count: number; total: number }

interface DashData {
  totalProducts: number
  lowStockProducts: Array<{ id: number; name: string; unit: string; currentStock: string; minStock: string; category: { name: string } }>
  today: { count: number; revenue: number }
  month: { costoCompras: number; ventas: number; ganancia: number }
  weekSales: WeekDay[]
  topItems: TopItem[]
  paymentBreakdown: PayMethod[]
}

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const PAYMENT_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo', DEBITO: 'Débito', CREDITO: 'Crédito',
  TRANSFERENCIA: 'Transferencia', MERCADOPAGO: 'MercadoPago', CUENTA_CORRIENTE: 'Cta. cte.',
}

function MiniBar({ value, max, color = 'bg-brand-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 2
  return (
    <div className="flex h-full w-full items-end">
      <div className={`w-full rounded-t ${color} transition-all duration-500`} style={{ height: `${pct}%` }} />
    </div>
  )
}

export default function Dashboard() {
  const [data, setData]         = useState<DashData | null>(null)
  const [botellas, setBotellas] = useState<BotellaActiva[]>([])
  const [error, setError]       = useState('')

  useEffect(() => {
    api.get<DashData>('/dashboard')
      .then((r) => setData(r.data))
      .catch((e) => setError(e?.response?.data?.error ?? e?.message ?? 'Error al cargar'))
    api.get<BotellaActiva[]>('/botellas').then((r) => setBotellas(r.data)).catch(() => {})
  }, [])

  if (error) return (
    <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-6 text-center">
      <p className="text-red-400 font-medium">Error al cargar el dashboard</p>
      <p className="mt-1 text-xs text-zinc-500">{error}</p>
    </div>
  )

  if (!data) return (
    <div className="flex h-48 items-center justify-center text-zinc-500">Cargando...</div>
  )

  const weekSales        = data.weekSales        ?? []
  const topItems         = data.topItems         ?? []
  const paymentBreakdown = data.paymentBreakdown ?? []
  const todayData        = data.today            ?? { count: (data as any).todayVentas ?? 0, revenue: 0 }

  const maxWeekRevenue = Math.max(...weekSales.map((d) => d.revenue), 1)
  const lowBotellas    = botellas.filter(b => Number(b.restante) <= Number(b.alertaOz))
  const totalPayment   = paymentBreakdown.reduce((s, p) => s + p.total, 0)

  return (
    <div className="flex flex-col gap-5">

      {/* ── Ganancia del mes ─────────────────────────────────────────────── */}
      <div className={`rounded-2xl p-5 ${data.month.ganancia >= 0 ? 'bg-gradient-to-br from-green-950 to-zinc-900 border border-green-900/40' : 'bg-gradient-to-br from-red-950 to-zinc-900 border border-red-900/40'}`}>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Ganancia del mes</p>
        <p className={`mt-1 text-4xl font-black tracking-tight ${data.month.ganancia >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {ARS(data.month.ganancia)}
        </p>
        <div className="mt-3 flex gap-4 text-xs text-zinc-500">
          <span>↑ Ventas <span className="text-zinc-300 font-medium">{ARS(data.month.ventas)}</span></span>
          <span>↓ Compras <span className="text-zinc-300 font-medium">{ARS(data.month.costoCompras)}</span></span>
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Hoy</p>
          <p className="mt-1 text-2xl font-bold text-zinc-100">{todayData.count}</p>
          <p className="text-xs text-zinc-500">{ARS(todayData.revenue)}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Ventas mes</p>
          <p className="mt-1 text-2xl font-bold text-zinc-100">{ARS(data.month.ventas)}</p>
          <p className="text-xs text-zinc-500">{data.lowStockProducts.length > 0 ? `${data.lowStockProducts.length} bajo stock` : 'stock OK'}</p>
        </div>
      </div>

      {/* ── Gráfico + top productos (side by side en desktop) ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

      {/* ── Gráfico semanal ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Últimos 7 días</p>
        <div className="flex h-24 items-end gap-1.5">
          {weekSales.map((d) => {
            const label = DAY_LABELS[new Date(d.date + 'T12:00:00').getDay()]
            const isToday = d.date === new Date().toISOString().slice(0, 10)
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full flex-1">
                  <MiniBar
                    value={d.revenue}
                    max={maxWeekRevenue}
                    color={isToday ? 'bg-brand-500' : 'bg-zinc-700'}
                  />
                </div>
                <span className={`text-[10px] ${isToday ? 'text-brand-400 font-bold' : 'text-zinc-600'}`}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-zinc-600">
          <span>{ARS(0)}</span>
          <span>{ARS(maxWeekRevenue)}</span>
        </div>
      </div>

      {/* ── Top productos ─────────────────────────────────────────────────── */}
      {topItems.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Más vendido este mes</p>
          <div className="flex flex-col gap-2">
            {topItems.map((item, i) => {
              const maxQty = topItems[0].qty
              const pct = Math.max(4, (item.qty / maxQty) * 100)
              return (
                <div key={item.nombre} className="flex items-center gap-3">
                  <span className="w-4 text-xs text-zinc-600 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm text-zinc-200 truncate">{item.nombre}</span>
                      <span className="text-xs text-zinc-500 shrink-0 ml-2">{item.qty} u.</span>
                    </div>
                    <div className="h-1 rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-brand-500/60 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500 shrink-0 w-20 text-right">{ARS(item.revenue)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      </div>{/* end grid grafico+top */}

      {/* ── Métodos de pago ───────────────────────────────────────────────── */}
      {paymentBreakdown.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Cobros del mes</p>
          <div className="flex flex-col gap-2">
            {paymentBreakdown
              .sort((a, b) => b.total - a.total)
              .map((p) => {
                const pct = totalPayment > 0 ? (p.total / totalPayment) * 100 : 0
                return (
                  <div key={p.method} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs text-zinc-400">{PAYMENT_LABELS[p.method] ?? p.method}</span>
                    <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-zinc-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400 w-20 text-right shrink-0">{ARS(p.total)}</span>
                    <span className="text-xs text-zinc-600 w-6 text-right shrink-0">{p.count}</span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* ── Alertas ───────────────────────────────────────────────────────── */}
      {(lowBotellas.length > 0 || data.lowStockProducts.length > 0) && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Alertas</p>

          {lowBotellas.map(b => (
            <Link key={b.id} to="/botellas"
              className="flex items-center justify-between rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-100">{b.product.name}</p>
                <p className="text-xs text-zinc-500">Botella por reponer</p>
              </div>
              <span className="text-sm font-bold text-red-400">{Number(b.restante).toFixed(1)} oz</span>
            </Link>
          ))}

          {data.lowStockProducts.map(p => (
            <Link key={p.id} to="/productos"
              className="flex items-center justify-between rounded-xl border border-orange-900/40 bg-orange-950/20 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-100">{p.name}</p>
                <p className="text-xs text-zinc-500">{p.category.name} · mín {p.minStock}</p>
              </div>
              <span className="text-sm font-bold text-orange-400">{p.currentStock} {p.unit}</span>
            </Link>
          ))}
        </div>
      )}

    </div>
  )
}
