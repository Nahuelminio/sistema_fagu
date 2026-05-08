import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { useToast } from '../../context/ToastContext'

interface GastoItem {
  id:     number
  nombre: string
  monto:  number
  mes:    string
}

interface Resumen {
  mes:             string
  cantVentas:      number
  totalVentas:     number
  costoMercaderia: number
  gananciaBruta:   number
  totalGastos:     number
  gananciaNeta:    number
  gastos:          GastoItem[]
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function mesLabel(mes: string) {
  const [y, m] = mes.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('es-AR', { month: 'long', year: 'numeric' })
}

export default function ResumenMensual() {
  const { showToast } = useToast()

  const today   = new Date()
  const initMes = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  const [mes, setMes]           = useState(initMes)
  const [resumen, setResumen]   = useState<Resumen | null>(null)
  const [loading, setLoading]   = useState(false)
  const [socios, setSocios]     = useState(3)

  // Nuevo gasto
  const [nombre, setNombre] = useState('')
  const [monto, setMonto]   = useState('')
  const [adding, setAdding] = useState(false)

  async function load(m: string) {
    setLoading(true)
    try {
      const r = await api.get<Resumen>(`/gastos/resumen?mes=${m}`)
      setResumen(r.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(mes) }, [mes])

  async function handleAddGasto() {
    if (!nombre.trim() || !monto) return
    setAdding(true)
    try {
      await api.post('/gastos', { nombre: nombre.trim(), monto: parseFloat(monto), mes })
      setNombre('')
      setMonto('')
      showToast('Gasto agregado')
      load(mes)
    } catch {
      showToast('Error al agregar gasto', 'error')
    } finally {
      setAdding(false)
    }
  }

  async function handleDeleteGasto(id: number) {
    try {
      await api.delete(`/gastos/${id}`)
      showToast('Gasto eliminado')
      load(mes)
    } catch {
      showToast('Error al eliminar', 'error')
    }
  }

  const r = resumen

  return (
    <div className="flex flex-col gap-5">
      {/* Header + selector de mes */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-zinc-100">Resumen mensual</h1>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500"
        />
      </div>

      {loading && <p className="text-center text-sm text-zinc-500 py-8">Cargando...</p>}

      {r && !loading && (
        <>
          <p className="text-sm font-medium capitalize text-zinc-400">{mesLabel(mes)}</p>

          {/* Tarjetas principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="Ventas del mes" value={formatARS(r.totalVentas)} sub={`${r.cantVentas} transacciones`} color="brand" />
            <Card label="Costo mercaderia" value={formatARS(r.costoMercaderia)} sub="costo de lo vendido" color="zinc" />
            <Card label="Ganancia bruta" value={formatARS(r.gananciaBruta)} sub="ventas - mercaderia" color={r.gananciaBruta >= 0 ? 'green' : 'red'} />
            <Card label="Total gastos" value={formatARS(r.totalGastos)} sub={`${r.gastos.length} gastos cargados`} color="orange" />
          </div>

          {/* Ganancia neta — destacada */}
          <div className={`rounded-2xl border px-5 py-4 flex items-center justify-between ${
            r.gananciaNeta >= 0
              ? 'border-green-800/50 bg-green-950/20'
              : 'border-red-800/50 bg-red-950/20'
          }`}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Ganancia neta</p>
              <p className="text-xs text-zinc-600 mt-0.5">ventas - mercaderia - gastos</p>
            </div>
            <span className={`text-2xl font-black ${r.gananciaNeta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatARS(r.gananciaNeta)}
            </span>
          </div>

          {/* Division por socios */}
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Division por socios</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Socios:</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={socios}
                  onChange={(e) => setSocios(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-center text-sm text-zinc-100 outline-none focus:border-brand-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">
                  {formatARS(r.gananciaNeta)} &divide; {socios}
                </p>
                <p className="text-xs text-zinc-600 mt-0.5">por socio este mes</p>
              </div>
              <span className={`text-3xl font-black ${r.gananciaNeta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatARS(Math.round(r.gananciaNeta / socios))}
              </span>
            </div>
          </div>

          {/* Gastos + Desglose — side by side en desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Gastos del mes */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Gastos variables del mes
            </p>

            {/* Lista de gastos */}
            {r.gastos.length === 0 ? (
              <p className="py-3 text-center text-sm text-zinc-600">Sin gastos cargados</p>
            ) : (
              <div className="mb-4 flex flex-col divide-y divide-zinc-800">
                {r.gastos.map((g) => (
                  <div key={g.id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-zinc-200">{g.nombre}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-orange-400">{formatARS(g.monto)}</span>
                      <button
                        onClick={() => handleDeleteGasto(g.id)}
                        className="text-xs text-zinc-600 hover:text-red-400 transition"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2.5">
                  <span className="text-xs font-semibold text-zinc-500">Total gastos</span>
                  <span className="text-sm font-bold text-orange-400">{formatARS(r.totalGastos)}</span>
                </div>
              </div>
            )}

            {/* Agregar gasto */}
            <div className="border-t border-zinc-800 pt-4">
              <p className="mb-2 text-xs font-medium text-zinc-500">Agregar gasto</p>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Luz, Hielo, Agua, Alquiler..."
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-brand-500"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    placeholder="Monto $"
                    className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-brand-500"
                  />
                  <button
                    onClick={handleAddGasto}
                    disabled={adding || !nombre.trim() || !monto}
                    className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-40"
                  >
                    {adding ? '...' : '+ Agregar'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Desglose */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Desglose</p>
            <div className="flex flex-col gap-2 text-sm">
              <Row label="Ingresos por ventas"    value={formatARS(r.totalVentas)}     color="text-zinc-100" />
              <Row label="- Costo de mercaderia"  value={formatARS(r.costoMercaderia)} color="text-zinc-400" minus />
              <div className="border-t border-zinc-800 my-1" />
              <Row label="Ganancia bruta"          value={formatARS(r.gananciaBruta)}   color={r.gananciaBruta >= 0 ? 'text-green-400' : 'text-red-400'} />
              {r.gastos.map((g) => (
                <Row key={g.id} label={`- ${g.nombre}`} value={formatARS(g.monto)} color="text-zinc-400" minus />
              ))}
              <div className="border-t border-zinc-800 my-1" />
              <Row label="Ganancia neta"           value={formatARS(r.gananciaNeta)}    color={r.gananciaNeta >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'} />
            </div>
          </div>

          </div>{/* end grid gastos+desglose */}
        </>
      )}
    </div>
  )
}

function Card({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    brand:  'text-brand-400',
    zinc:   'text-zinc-300',
    green:  'text-green-400',
    red:    'text-red-400',
    orange: 'text-orange-400',
  }
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 flex flex-col gap-1">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-lg font-bold leading-tight ${colors[color] ?? 'text-zinc-100'}`}>{value}</p>
      <p className="text-xs text-zinc-600">{sub}</p>
    </div>
  )
}

function Row({ label, value, color, minus }: { label: string; value: string; color: string; minus?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={minus ? 'text-zinc-500' : 'text-zinc-300'}>{label}</span>
      <span className={color}>{value}</span>
    </div>
  )
}
