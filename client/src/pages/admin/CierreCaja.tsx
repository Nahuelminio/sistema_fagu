import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { PAYMENT_LABELS, PaymentMethod } from '../../types'

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

interface CierreData {
  date: string
  totalVentas: number
  totalRevenue: number
  paymentBreakdown: { method: string; count: number; total: number }[]
  topItems: { nombre: string; qty: number; revenue: number }[]
  ventas: {
    id: number; createdAt: string; total: number
    paymentMethod: string; user: string
    items: { nombre: string; quantity: string; unitPrice: string }[]
  }[]
}

export default function CierreCaja() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate]   = useState(today)
  const [data, setData]   = useState<CierreData | null>(null)
  const [loading, setLoading] = useState(false)

  async function load(d: string) {
    setLoading(true)
    try {
      const r = await api.get<CierreData>(`/dashboard/cierre?date=${d}`)
      setData(r.data)
    } catch {
      // el error de carga se muestra como pantalla vacía — no bloquea la UI
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(date) }, [date])

  function handlePrint() { window.print() }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold text-zinc-100">Cierre de caja</h1>
        <button
          onClick={handlePrint}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition"
        >
          🖨 Imprimir
        </button>
      </div>

      {/* Selector de fecha */}
      <div className="flex gap-2 print:hidden">
        <input
          type="date"
          value={date}
          max={today}
          onChange={e => setDate(e.target.value)}
          className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
        />
        <button
          onClick={() => load(date)}
          className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-black"
        >
          Ver
        </button>
      </div>

      {loading && <p className="text-center text-zinc-500">Cargando...</p>}

      {data && (
        <>
          {/* Encabezado imprimible */}
          <div className="hidden print:block text-center mb-4">
            <p className="text-lg font-black">FAGU Drink Bar</p>
            <p className="text-sm">Cierre de caja — {data.date}</p>
          </div>

          {/* Total */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Total del día</p>
            <p className="mt-1 text-4xl font-black text-zinc-100">{ARS(data.totalRevenue)}</p>
            <p className="mt-1 text-sm text-zinc-500">{data.totalVentas} venta{data.totalVentas !== 1 ? 's' : ''}</p>
          </div>

          {/* Por método de pago */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Por método de pago</p>
            {data.paymentBreakdown.length === 0 ? (
              <p className="text-sm text-zinc-600">Sin ventas</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.paymentBreakdown.sort((a, b) => b.total - a.total).map(p => (
                  <div key={p.method} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-300">{PAYMENT_LABELS[p.method as PaymentMethod] ?? p.method}</span>
                      <span className="text-xs text-zinc-600">{p.count} vta{p.count !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="font-semibold text-zinc-100">{ARS(p.total)}</span>
                  </div>
                ))}
                <div className="mt-1 border-t border-zinc-800 pt-2 flex justify-between">
                  <span className="text-sm font-semibold text-zinc-400">Total</span>
                  <span className="font-bold text-zinc-100">{ARS(data.totalRevenue)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Más vendido */}
          {data.topItems.length > 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Más vendido hoy</p>
              <div className="flex flex-col gap-1.5">
                {data.topItems.map((item, i) => (
                  <div key={item.nombre} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-600 w-4">{i + 1}</span>
                      <span className="text-sm text-zinc-300">{item.nombre}</span>
                      <span className="text-xs text-zinc-600">{item.qty} u.</span>
                    </div>
                    <span className="text-sm text-zinc-400">{ARS(item.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detalle de ventas */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Detalle de ventas ({data.ventas.length})
            </p>
            {data.ventas.length === 0 ? (
              <p className="text-sm text-zinc-600">Sin ventas en esta fecha</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.ventas.map(v => (
                  <div key={v.id} className="rounded-xl border border-zinc-800 bg-zinc-800/40 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-600">#{v.id}</span>
                        <span className="text-xs text-zinc-500">
                          {new Date(v.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-xs text-zinc-600">{v.user}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">{PAYMENT_LABELS[v.paymentMethod as PaymentMethod] ?? v.paymentMethod}</span>
                        <span className="text-sm font-semibold text-zinc-200">{ARS(v.total)}</span>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">
                      {v.items.map(i => `${i.nombre} ×${Number(i.quantity)}`).join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
