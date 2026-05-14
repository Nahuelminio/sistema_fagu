import { useEffect, useState } from 'react'
import api from '../lib/api'
import Button from '../components/ui/Button'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../context/ConfirmContext'
import CierreModal from '../components/CierreModal'

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

interface Movimiento {
  id: number
  tipo: 'RETIRO' | 'APORTE'
  monto: string
  motivo: string | null
  createdAt: string
  user: { id: number; name: string }
}

interface CajaActual {
  id: number
  fondoInicial: number
  fechaApertura: string
  notasApertura: string | null
  user: { id: number; name: string }
  movimientos: Movimiento[]
  metricas: {
    cantVentas:       number
    totalVentas:      number
    efectivoVentas:   number
    totalAportes:     number
    totalRetiros:     number
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
  cantVentas: number
  totalVentas: number
  ventasPorMetodo: { method: string; total: number }[]
}

interface HistorialResp {
  cajas: CajaCerrada[]
  stats: {
    cantCierres: number
    totalAcumulado: number
    diferenciaAcumulada: number
  }
}

const PAYMENT_LABELS: Record<string, string> = {
  EFECTIVO:         'Efectivo',
  DEBITO:           'Débito',
  CREDITO:          'Crédito',
  TRANSFERENCIA:    'Transferencia',
  MERCADOPAGO:      'MercadoPago',
  CUENTA_CORRIENTE: 'Cuenta corriente',
}

function formatDuracion(fechaApertura: string): { texto: string; horas: number } {
  const ms = Date.now() - new Date(fechaApertura).getTime()
  const horas = ms / 3_600_000
  const h = Math.floor(horas)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return { texto: `${h}h ${m}min`, horas }
}

export default function Caja() {
  const { showToast } = useToast()
  const { isAdmin }   = useAuth()
  const confirm       = useConfirm()
  const [caja, setCaja]               = useState<CajaActual | null>(null)
  const [historial, setHistorial]     = useState<CajaCerrada[]>([])
  const [stats, setStats]             = useState<HistorialResp['stats'] | null>(null)
  const [loading, setLoading]         = useState(true)
  // Forms
  const [fondo, setFondo]             = useState('')
  const [notasAp, setNotasAp]         = useState('')
  const [contado, setContado]         = useState('')
  const [notasCi, setNotasCi]         = useState('')
  const [saving, setSaving]           = useState(false)
  // Movimientos
  const [showMovForm, setShowMovForm] = useState<'RETIRO' | 'APORTE' | null>(null)
  const [movMonto, setMovMonto]       = useState('')
  const [movMotivo, setMovMotivo]     = useState('')
  // Filtros
  const [filterFrom, setFilterFrom]   = useState('')
  const [filterTo, setFilterTo]       = useState('')
  // Cierre modal (recién cerrado o ver desde historial)
  const [cierreVerId, setCierreVerId] = useState<number | null>(null)
  // Tick para auto-refresh de duración
  const [tick, setTick]               = useState(0)

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '30' })
      if (filterFrom) params.set('from', filterFrom)
      if (filterTo)   params.set('to',   filterTo)

      const promesas: [Promise<{ data: CajaActual | null }>, Promise<{ data: HistorialResp }>?] = [
        api.get<CajaActual | null>('/caja/actual'),
      ]
      if (isAdmin) promesas[1] = api.get<HistorialResp>(`/caja/historial?${params}`)

      const [act, hist] = await Promise.all(promesas as [Promise<{data: CajaActual | null}>, Promise<{data: HistorialResp}>])
      setCaja(act.data)
      setHistorial(hist?.data?.cajas ?? [])
      setStats(hist?.data?.stats ?? null)
    } catch {
      showToast('Error al cargar la caja', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Auto-refresh cada 30s si hay caja abierta
  useEffect(() => {
    if (!caja) return
    const interval = setInterval(() => { load() }, 30_000)
    return () => clearInterval(interval)
  }, [caja?.id])

  // Tick cada 30s para actualizar la duración del turno
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  async function handleReabrir(id: number) {
    const ok = await confirm({
      title: 'Reabrir cierre',
      message: 'Vas a poder volver a cerrar la caja con los datos correctos.',
      confirmLabel: 'Reabrir',
    })
    if (!ok) return
    try {
      await api.post(`/caja/${id}/reabrir`)
      showToast('Caja reabierta')
      load()
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? 'Error al reabrir', 'error')
    }
  }

  async function handleAbrir() {
    const monto = parseFloat(fondo)
    if (isNaN(monto) || monto < 0) { showToast('Fondo inicial inválido', 'error'); return }
    setSaving(true)
    try {
      await api.post('/caja/abrir', { fondoInicial: monto, notas: notasAp || undefined })
      showToast(`Caja abierta con ${ARS(monto)}`)
      setFondo(''); setNotasAp('')
      load()
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? 'Error al abrir caja', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleCerrar() {
    if (!caja) return
    const monto = parseFloat(contado)
    if (isNaN(monto) || monto < 0) { showToast('Ingresá el efectivo contado', 'error'); return }
    const ok = await confirm({
      title: 'Cerrar caja',
      message: `¿Cerrar la caja con ${ARS(monto)} contados?`,
      confirmLabel: 'Cerrar caja',
    })
    if (!ok) return
    setSaving(true)
    try {
      const res = await api.post<{ id: number }>('/caja/cerrar', { efectivoContado: monto, notas: notasCi || undefined })
      showToast('Caja cerrada')
      setContado(''); setNotasCi('')
      setCierreVerId(res.data.id) // mostrar modal con el cierre listo para imprimir
      load()
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? 'Error al cerrar caja', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleMovimiento() {
    if (!showMovForm) return
    const monto = parseFloat(movMonto)
    if (isNaN(monto) || monto <= 0) { showToast('Monto inválido', 'error'); return }
    try {
      await api.post('/caja/movimiento', { tipo: showMovForm, monto, motivo: movMotivo || undefined })
      showToast(showMovForm === 'RETIRO' ? 'Retiro registrado' : 'Aporte registrado')
      setMovMonto(''); setMovMotivo(''); setShowMovForm(null)
      load()
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? 'Error al registrar', 'error')
    }
  }

  async function handleDeleteMov(id: number) {
    const ok = await confirm({
      title: 'Eliminar movimiento',
      message: '¿Eliminar este movimiento de caja?',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/caja/movimiento/${id}`)
      showToast('Movimiento eliminado', 'info')
      load()
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? 'Error al eliminar', 'error')
    }
  }

  if (loading) return <div className="flex h-48 items-center justify-center text-zinc-500">Cargando...</div>

  // Duración del turno (se recalcula con tick)
  const duracion = caja ? formatDuracion(caja.fechaApertura) : null
  void tick
  const turnoLargo = duracion && duracion.horas > 12

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Caja</h1>
        <p className="text-sm text-zinc-500">Apertura, cierre y movimientos del día</p>
      </div>

      {/* ── CAJA ABIERTA ── */}
      {caja ? (
        <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-5">
          <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-block rounded-full bg-green-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-400">
                  Caja abierta
                </span>
                {duracion && (
                  <span className={`text-xs font-semibold ${turnoLargo ? 'text-yellow-400' : 'text-zinc-400'}`}>
                    {duracion.texto}
                    {turnoLargo && ' ⚠ turno largo'}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                Por <span className="text-zinc-200 font-medium">{caja.user.name}</span> desde{' '}
                {new Date(caja.fechaApertura).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
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

          {/* Aportes / Retiros */}
          {(caja.metricas.totalAportes > 0 || caja.metricas.totalRetiros > 0) && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {caja.metricas.totalAportes > 0 && (
                <Card label="Aportes" value={`+ ${ARS(caja.metricas.totalAportes)}`} color="green"/>
              )}
              {caja.metricas.totalRetiros > 0 && (
                <Card label="Retiros" value={`- ${ARS(caja.metricas.totalRetiros)}`} color="red"/>
              )}
            </div>
          )}

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

          {/* Botones de movimientos */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => { setShowMovForm('APORTE'); setMovMonto(''); setMovMotivo('') }}
              className="flex-1 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm font-semibold text-green-400 hover:bg-green-500/20 transition"
            >
              + Aporte
            </button>
            <button
              onClick={() => { setShowMovForm('RETIRO'); setMovMonto(''); setMovMotivo('') }}
              className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition"
            >
              − Retiro
            </button>
          </div>

          {/* Form de movimiento */}
          {showMovForm && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 mb-4 flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Nuevo {showMovForm === 'APORTE' ? 'aporte' : 'retiro'}
              </p>
              <input
                type="number" step="1" min="0"
                value={movMonto}
                onChange={(e) => setMovMonto(e.target.value)}
                placeholder="Monto"
                autoFocus
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500"
              />
              <input
                type="text"
                value={movMotivo}
                onChange={(e) => setMovMotivo(e.target.value)}
                placeholder="Motivo (opcional)"
                onKeyDown={(e) => { if (e.key === 'Enter') handleMovimiento() }}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500"
              />
              <div className="flex gap-2">
                <Button onClick={handleMovimiento}>Confirmar</Button>
                <Button variant="ghost" onClick={() => setShowMovForm(null)}>Cancelar</Button>
              </div>
            </div>
          )}

          {/* Listado de movimientos */}
          {caja.movimientos.length > 0 && (
            <div className="rounded-xl bg-zinc-950/40 px-4 py-3 mb-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2">Movimientos del turno</p>
              <div className="flex flex-col gap-1">
                {caja.movimientos.map((m) => (
                  <div key={m.id} className="flex items-start justify-between text-xs gap-2">
                    <div className="flex-1 min-w-0">
                      <span className={`font-semibold ${m.tipo === 'APORTE' ? 'text-green-400' : 'text-red-400'}`}>
                        {m.tipo === 'APORTE' ? '+ ' : '− '}{ARS(Number(m.monto))}
                      </span>
                      <span className="text-zinc-500 ml-2">
                        {new Date(m.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · {m.user.name}
                      </span>
                      {m.motivo && <p className="text-zinc-400 italic truncate">"{m.motivo}"</p>}
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteMov(m.id)}
                        className="text-zinc-600 hover:text-red-400 transition shrink-0"
                      >
                        ✕
                      </button>
                    )}
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
              {contado && !isNaN(parseFloat(contado)) && (() => {
                const dif = parseFloat(contado) - caja.metricas.efectivoEsperado
                return (
                  <p className={`text-xs font-semibold ${dif === 0 ? 'text-green-400' : dif > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                    Diferencia: {ARS(dif)}
                    {dif === 0 && ' · Perfecto'}
                    {dif > 0 && ' · Sobra'}
                    {dif < 0 && ' · Falta'}
                  </p>
                )
              })()}

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
          <div className="flex items-end justify-between gap-2 mb-3 flex-wrap">
            <div>
              <h2 className="text-base font-bold text-zinc-200">Historial de cierres</h2>
              {stats && stats.cantCierres > 0 && (
                <p className="text-xs text-zinc-500">
                  {stats.cantCierres} cierres · vendido {ARS(stats.totalAcumulado)} ·
                  <span className={`ml-1 ${stats.diferenciaAcumulada === 0 ? 'text-green-400' : stats.diferenciaAcumulada > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                    diferencia neta {ARS(stats.diferenciaAcumulada)}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Filtros */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 mb-3 flex flex-col md:flex-row gap-2 md:items-end">
            <div className="flex-1">
              <label className="text-xs text-zinc-500">Desde</label>
              <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-zinc-500">Hasta</label>
              <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-500"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={load}>Filtrar</Button>
              <Button variant="ghost" onClick={() => { setFilterFrom(''); setFilterTo(''); setTimeout(load, 0) }}>Limpiar</Button>
            </div>
          </div>

          {historial.length === 0 ? (
            <p className="text-sm text-zinc-600">No hay cierres en este período</p>
          ) : (
            <div className="flex flex-col gap-2">
              {historial.map((c) => {
                const dif = Number(c.diferencia)
                return (
                  <div key={c.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-100">
                          {new Date(c.fechaApertura).toLocaleDateString('es-AR')}
                          {' '}
                          <span className="text-zinc-500">→</span>
                          {' '}
                          {new Date(c.fechaCierre).toLocaleDateString('es-AR')}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {c.user.name} ·{' '}
                          {new Date(c.fechaApertura).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          {' a '}
                          {new Date(c.fechaCierre).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          {' · '}
                          {c.cantVentas} ventas · {ARS(c.totalVentas)}
                        </p>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${dif === 0 ? 'text-green-400' : dif > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
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
                    <div className="mt-3 flex flex-wrap gap-2 items-center text-xs">
                      <button
                        onClick={() => setCierreVerId(c.id)}
                        className="rounded-lg bg-brand-500 px-3 py-1.5 font-semibold text-white hover:bg-brand-400 transition"
                      >
                        Ver / Imprimir
                      </button>
                      {!caja && (
                        <button
                          onClick={() => handleReabrir(c.id)}
                          className="text-zinc-500 hover:text-brand-400 transition"
                        >
                          Reabrir
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {cierreVerId !== null && (
        <CierreModal cajaId={cierreVerId} onClose={() => setCierreVerId(null)} />
      )}
    </div>
  )
}

function Card({ label, value, sub, color }: {
  label: string; value: string; sub?: string
  color: 'zinc' | 'brand' | 'green' | 'red'
}) {
  const colors = {
    zinc:  'border-zinc-800 bg-zinc-900',
    brand: 'border-brand-500/30 bg-brand-500/10',
    green: 'border-green-500/30 bg-green-500/10',
    red:   'border-red-500/30 bg-red-500/10',
  }
  const valueColor = {
    zinc:  'text-zinc-100',
    brand: 'text-brand-300',
    green: 'text-green-400',
    red:   'text-red-400',
  }
  return (
    <div className={`rounded-2xl border ${colors[color]} p-4`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${valueColor[color]}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-500">{sub}</p>}
    </div>
  )
}
