import { useEffect, useState } from 'react'
import api from '../lib/api'

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const PAYMENT_LABELS: Record<string, string> = {
  EFECTIVO:         'Efectivo',
  DEBITO:           'Débito',
  CREDITO:          'Crédito',
  TRANSFERENCIA:    'Transferencia',
  MERCADOPAGO:      'MercadoPago',
  CUENTA_CORRIENTE: 'Cuenta corriente',
}

interface CierreDetalle {
  id: number
  status: string
  fondoInicial: number
  fechaApertura: string
  fechaCierre: string | null
  efectivoEsperado: string | null
  efectivoContado: string | null
  diferencia: string | null
  notasApertura: string | null
  notasCierre: string | null
  user: { id: number; name: string }
  movimientos: {
    id: number
    tipo: 'RETIRO' | 'APORTE'
    monto: string
    motivo: string | null
    createdAt: string
    user: { name: string }
  }[]
  metricas: {
    cantVentas:     number
    totalVentas:    number
    efectivoVentas: number
    porMetodo:      { method: string; count: number; total: number }[]
  }
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function duracion(from: string, to: string | null): string {
  if (!to) return '-'
  const ms = new Date(to).getTime() - new Date(from).getTime()
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return `${h}h ${m}min`
}

export default function CierreModal({ cajaId, onClose }: { cajaId: number; onClose: () => void }) {
  const [data, setData] = useState<CierreDetalle | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<CierreDetalle>(`/caja/${cajaId}`)
      .then((r) => setData(r.data))
      .catch(() => onClose())
      .finally(() => setLoading(false))
  }, [cajaId])

  function handlePrint() { window.print() }

  if (loading) {
    return (
      <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur">
        <p className="text-zinc-400">Cargando...</p>
      </div>
    )
  }
  if (!data) return null

  const dif = Number(data.diferencia ?? 0)
  const aportes = data.movimientos.filter(m => m.tipo === 'APORTE')
  const retiros = data.movimientos.filter(m => m.tipo === 'RETIRO')
  const totalAportes = aportes.reduce((s, m) => s + Number(m.monto), 0)
  const totalRetiros = retiros.reduce((s, m) => s + Number(m.monto), 0)

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur print:bg-white print:p-0"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        id="cierre-print"
        className="my-8 w-full max-w-2xl rounded-2xl bg-white text-zinc-900 shadow-2xl print:my-0 print:rounded-none print:shadow-none"
      >
        {/* Header */}
        <div className="border-b-2 border-zinc-300 p-5 flex items-start justify-between">
          <div>
            <p className="text-2xl font-black tracking-wider">FAGU</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Drink Bar</p>
            <p className="mt-2 text-[10px] text-zinc-500">DOÑA ZOPPI S.R.L. · CUIT 30-71821464-1</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">Cierre de caja</p>
            <p className="text-xs text-zinc-600">N° {String(data.id).padStart(6, '0')}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {data.status === 'CERRADA' ? 'Cerrada' : 'Abierta'}
            </p>
          </div>
        </div>

        {/* Datos generales */}
        <div className="border-b border-zinc-300 px-5 py-3 grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Apertura</p>
            <p className="font-medium">{formatFecha(data.fechaApertura)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Cierre</p>
            <p className="font-medium">{data.fechaCierre ? formatFecha(data.fechaCierre) : '—'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Operador</p>
            <p className="font-medium">{data.user.name}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Duración del turno</p>
            <p className="font-medium">{duracion(data.fechaApertura, data.fechaCierre)}</p>
          </div>
        </div>

        {/* Resumen económico */}
        <div className="px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Resumen</p>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-zinc-200">
                <td className="py-1.5">Fondo inicial</td>
                <td className="py-1.5 text-right font-medium">{ARS(Number(data.fondoInicial))}</td>
              </tr>
              <tr className="border-b border-zinc-200">
                <td className="py-1.5">Ventas en efectivo ({data.metricas.cantVentas} transacciones)</td>
                <td className="py-1.5 text-right font-medium">{ARS(data.metricas.efectivoVentas)}</td>
              </tr>
              {totalAportes > 0 && (
                <tr className="border-b border-zinc-200">
                  <td className="py-1.5">Aportes</td>
                  <td className="py-1.5 text-right font-medium text-green-700">+ {ARS(totalAportes)}</td>
                </tr>
              )}
              {totalRetiros > 0 && (
                <tr className="border-b border-zinc-200">
                  <td className="py-1.5">Retiros</td>
                  <td className="py-1.5 text-right font-medium text-red-700">− {ARS(totalRetiros)}</td>
                </tr>
              )}
              <tr className="border-b border-zinc-200">
                <td className="py-1.5 font-semibold">Efectivo esperado</td>
                <td className="py-1.5 text-right font-bold">{ARS(Number(data.efectivoEsperado ?? 0))}</td>
              </tr>
              {data.efectivoContado != null && (
                <>
                  <tr className="border-b border-zinc-200">
                    <td className="py-1.5">Efectivo contado</td>
                    <td className="py-1.5 text-right font-medium">{ARS(Number(data.efectivoContado))}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 font-bold">Diferencia</td>
                    <td className={`py-1.5 text-right font-bold ${dif === 0 ? 'text-green-700' : dif > 0 ? 'text-yellow-700' : 'text-red-700'}`}>
                      {ARS(dif)} {dif === 0 ? '· Perfecto' : dif > 0 ? '· Sobra' : '· Falta'}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Ventas por método */}
        {data.metricas.porMetodo.length > 0 && (
          <div className="border-t border-zinc-300 px-5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Ventas por método de pago</p>
            <table className="w-full text-sm">
              <tbody>
                {data.metricas.porMetodo.map((m) => (
                  <tr key={m.method} className="border-b border-zinc-200">
                    <td className="py-1">{PAYMENT_LABELS[m.method] ?? m.method}</td>
                    <td className="py-1 text-center text-zinc-500">{m.count}</td>
                    <td className="py-1 text-right font-medium">{ARS(m.total)}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="py-1">Total</td>
                  <td className="py-1 text-center text-zinc-500">{data.metricas.cantVentas}</td>
                  <td className="py-1 text-right">{ARS(data.metricas.totalVentas)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Movimientos */}
        {data.movimientos.length > 0 && (
          <div className="border-t border-zinc-300 px-5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Movimientos de caja</p>
            <div className="flex flex-col gap-1 text-xs">
              {data.movimientos.map((m) => (
                <div key={m.id} className="flex justify-between border-b border-zinc-200 py-1">
                  <div>
                    <span className={`font-semibold ${m.tipo === 'APORTE' ? 'text-green-700' : 'text-red-700'}`}>
                      {m.tipo === 'APORTE' ? '+' : '−'} {ARS(Number(m.monto))}
                    </span>
                    <span className="text-zinc-500 ml-2">
                      {new Date(m.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · {m.user.name}
                    </span>
                    {m.motivo && <p className="text-zinc-600 italic">{m.motivo}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notas */}
        {(data.notasApertura || data.notasCierre) && (
          <div className="border-t border-zinc-300 px-5 py-3 text-xs text-zinc-600">
            {data.notasApertura && <p><span className="font-semibold">Apertura:</span> {data.notasApertura}</p>}
            {data.notasCierre && <p><span className="font-semibold">Cierre:</span> {data.notasCierre}</p>}
          </div>
        )}

        {/* Acciones */}
        <div className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-3 print:hidden">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 transition"
          >
            Imprimir / PDF
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #cierre-print, #cierre-print * { visibility: visible; }
          #cierre-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  )
}
