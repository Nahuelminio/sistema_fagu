import { useEffect, useState } from 'react'
import api from '../lib/api'
import Button from '../components/ui/Button'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

interface CajaActual {
  id: number
  fondoInicial: number
  fechaApertura: string
  notasApertura: string | null
  user: { id: number; name: string }
  metricas: {
    cantVentas:       number
    totalVentas:      number
    efectivoVentas:   number
    efectivoEsperado: number
    porMetodo:        { method: string; total: number }[]
  }
}

interface CajaCerrada {
  id: number
  user: { id: number; name: string }
  fondoInicial: string
  fechaApertura: string
  fechaCierre: string
  efectivoEsperado: string
  efectivoContado: string
  diferencia: string
  notasApertura: string | null
  notasCierre: string | null
}

const PAYMENT_LABELS: Record<string, string> = {
  EFECTIVO:         'Efectivo',
  DEBITO:           'Débito',
  CREDITO:          'Crédito',
  TRANSFERENCIA:    'Transferencia',
  MERCADOPAGO:      'MercadoPago',
  CUENTA_CORRIENTE: 'Cuenta corriente',
}

export default function Caja() {
  const { showToast } = useToast()
  const { isAdmin } = useAuth()
  const [caja, setCaja]               = useState<CajaActual | null>(null)
  const [historial, setHistorial]     = useState<CajaCerrada[]>([])
  const [loading, setLoading]         = useState(true)
  // Form apertura
  const [fondo, setFondo]             = useState('')
  const [notasAp, setNotasAp]         = useState('')
  // Form cierre
  const [contado, setContado]         = useState('')
  const [notasCi, setNotasCi]         = useState('')
  const [saving, setSaving]           = useState(false)

  async function load() {
    setLoading(true)
    try {
      const promesas: [Promise<{ data: CajaActual | null }>, Promise<{ data: CajaCerrada[] }>?] = [
        api.get<CajaActual | null>('/caja/actual'),
      ]
      // El historial solo lo pueden ver admins
      if (isAdmin) promesas[1] = api.get<CajaCerrada[]>('/caja/historial?limit=15')

      const [act, hist] = await Promise.all(promesas as [Promise<{data: CajaActual | null}>, Promise<{data: CajaCerrada[]}>])
      setCaja(act.data)
      setHistorial(hist?.data ?? [])
    } catch {
      showToast('Error al cargar la caja', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleReabrir(id: number) {
    if (!confirm('¿Reabrir esta caja? Vas a poder volver a cerrarla con los datos correctos.')) return
    try {
      await api.post(`/caja/${id}/reabrir`)
      showToast('Caja reabierta')
      load()
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? 'Error al reabrir', 'error')
    }
  }

  useEffect(() => { load() }, [])

  async function handleAbrir() {
    const monto = parseFloat(fondo)
    if (isNaN(monto) || monto < 0) {
      showToast('Ingresá un fondo inicial válido', 'error')
      return
    }
    setSaving(true)
    try {
      await api.post('/caja/abrir', { fondoInicial: monto, notas: notasAp || undefined })
      showToast(`Caja abierta con ${ARS(monto)}`)
      setFondo('')
      setNotasAp('')
      load()
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? 'Error al abrir caja', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleCerrar() {
    const monto = parseFloat(contado)
    if (isNaN(monto) || monto < 0) {
      showToast('Ingresá el efectivo contado', 'error')
      return
    }
    if (!confirm(`¿Cerrar la caja con ${ARS(monto)} contados?`)) return
    setSaving(true)
    try {
      await api.post('/caja/cerrar', { efectivoContado: monto, notas: notasCi || undefined })
      showToast('Caja cerrada')
      setContado('')
      setNotasCi('')
      load()
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? 'Error al cerrar caja', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex h-48 items-center justify-center text-zinc-500">Cargando...</div>

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Caja</h1>
        <p className="text-sm text-zinc-500">Apertura y cierre del día</p>
      </div>

      {/* ── CAJA ABIERTA ── */}
      {caja ? (
        <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="inline-block rounded-full bg-green-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-400">
                Caja abierta
              </span>
              <p className="mt-1 text-sm text-zinc-400">
                Abierta por <span className="text-zinc-200 font-medium">{caja.user.name}</span> el{' '}
                {new Date(caja.fechaApertura).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card label="Fondo inicial"     value={ARS(caja.fondoInicial)}              color="zinc"/>
            <Card label="Ventas efectivo"   value={ARS(caja.metricas.efectivoVentas)}   color="zinc"/>
            <Card label="Efectivo esperado" value={ARS(caja.metricas.efectivoEsperado)} color="brand"/>
            <Card label="Total ventas"      value={ARS(caja.metricas.totalVentas)}      sub={`${caja.metricas.cantVentas} transac.`} color="green"/>
          </div>

          {/* Desglose por método */}
          {caja.metricas.porMetodo.length > 0 && (
            <div className="rounded-xl bg-zinc-950/40 px-4 py-3 mb-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2">Ventas por método</p>
              <div className="flex flex-col gap-1">
                {caja.metricas.porMetodo.map((m) => (
                  <div key={m.method} className="flex justify-between text-sm">
                    <span className="text-zinc-400">{PAYMENT_LABELS[m.method] ?? m.method}</span>
                    <span className="text-zinc-200 font-medium">{ARS(m.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form de cierre */}
          <div className="border-t border-zinc-800 pt-4">
            <p className="text-sm font-semibold text-zinc-200 mb-3">Cerrar caja</p>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-zinc-500">Efectivo contado físicamente</label>
              <input
                type="number" step="1" min="0"
                value={contado}
                onChange={(e) => setContado(e.target.value)}
                placeholder={`Ej: ${caja.metricas.efectivoEsperado}`}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500"
              />
              {contado && (
                <p className={`text-xs font-semibold ${
                  parseFloat(contado) - caja.metricas.efectivoEsperado === 0 ? 'text-green-400' :
                  parseFloat(contado) - caja.metricas.efectivoEsperado > 0 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  Diferencia: {ARS(parseFloat(contado) - caja.metricas.efectivoEsperado)}
                  {parseFloat(contado) - caja.metricas.efectivoEsperado === 0 && ' · Perfecto'}
                  {parseFloat(contado) - caja.metricas.efectivoEsperado > 0 && ' · Sobra'}
                  {parseFloat(contado) - caja.metricas.efectivoEsperado < 0 && ' · Falta'}
                </p>
              )}

              <label className="text-xs text-zinc-500 mt-2">Notas (opcional)</label>
              <input
                type="text"
                value={notasCi}
                onChange={(e) => setNotasCi(e.target.value)}
                placeholder="Observaciones del cierre..."
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500"
              />

              <Button onClick={handleCerrar} loading={saving} className="mt-2">Cerrar caja</Button>
            </div>
          </div>
        </div>
      ) : (
        /* ── ABRIR CAJA ── */
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <span className="inline-block rounded-full bg-zinc-800 border border-zinc-700 px-3 py-1 text-xs font-bold uppercase tracking-wide text-zinc-400">
            Caja cerrada
          </span>
          <p className="mt-2 text-sm text-zinc-400">No hay caja abierta. Abrí una para empezar a operar.</p>

          <div className="mt-4 flex flex-col gap-2">
            <label className="text-xs text-zinc-500">Fondo inicial (efectivo con que arrancás)</label>
            <input
              type="number" step="1" min="0"
              value={fondo}
              onChange={(e) => setFondo(e.target.value)}
              placeholder="Ej: 20000"
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500"
            />
            <label className="text-xs text-zinc-500 mt-2">Notas (opcional)</label>
            <input
              type="text"
              value={notasAp}
              onChange={(e) => setNotasAp(e.target.value)}
              placeholder="Observaciones de apertura..."
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500"
            />
            <Button onClick={handleAbrir} loading={saving} className="mt-2">Abrir caja</Button>
          </div>
        </div>
      )}

      {/* ── HISTORIAL (solo admin) ── */}
      {isAdmin && (
      <div>
        <h2 className="text-base font-bold text-zinc-200 mb-3">Historial de cierres</h2>
        {historial.length === 0 ? (
          <p className="text-sm text-zinc-600">Todavía no hay cierres registrados</p>
        ) : (
          <div className="flex flex-col gap-2">
            {historial.map((c) => {
              const dif = Number(c.diferencia)
              return (
                <div key={c.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">
                        {new Date(c.fechaApertura).toLocaleDateString('es-AR')}
                        {' → '}
                        {new Date(c.fechaCierre).toLocaleDateString('es-AR')}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {c.user.name} ·{' '}
                        {new Date(c.fechaApertura).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        {' a '}
                        {new Date(c.fechaCierre).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className={`text-sm font-bold ${dif === 0 ? 'text-green-400' : dif > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {dif === 0 ? 'OK' : ARS(dif)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-zinc-600">Fondo</p>
                      <p className="text-zinc-300 font-medium">{ARS(Number(c.fondoInicial))}</p>
                    </div>
                    <div>
                      <p className="text-zinc-600">Esperado</p>
                      <p className="text-zinc-300 font-medium">{ARS(Number(c.efectivoEsperado))}</p>
                    </div>
                    <div>
                      <p className="text-zinc-600">Contado</p>
                      <p className="text-zinc-300 font-medium">{ARS(Number(c.efectivoContado))}</p>
                    </div>
                  </div>
                  {(c.notasApertura || c.notasCierre) && (
                    <div className="mt-2 text-xs text-zinc-500 italic">
                      {c.notasApertura && <p>Apertura: "{c.notasApertura}"</p>}
                      {c.notasCierre && <p>Cierre: "{c.notasCierre}"</p>}
                    </div>
                  )}
                  {/* Botón reabrir — solo si no hay caja abierta */}
                  {!caja && (
                    <button
                      onClick={() => handleReabrir(c.id)}
                      className="mt-2 text-xs text-zinc-600 hover:text-brand-400 transition"
                    >
                      Reabrir este cierre
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      )}
    </div>
  )
}

function Card({ label, value, sub, color }: {
  label: string; value: string; sub?: string
  color: 'zinc' | 'brand' | 'green'
}) {
  const colors = {
    zinc:  'border-zinc-800 bg-zinc-900',
    brand: 'border-brand-500/30 bg-brand-500/10',
    green: 'border-green-500/30 bg-green-500/10',
  }
  const valueColor = {
    zinc:  'text-zinc-100',
    brand: 'text-brand-300',
    green: 'text-green-400',
  }
  return (
    <div className={`rounded-2xl border ${colors[color]} p-4`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${valueColor[color]}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-500">{sub}</p>}
    </div>
  )
}
