import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { BotellaActiva, Product } from '../../types'

// Capacidades estándar en oz
const PRESETS = [
  { label: '750 ml (25.4 oz)', value: 25.36 },
  { label: '1 L (33.8 oz)', value: 33.81 },
  { label: '500 ml (16.9 oz)', value: 16.91 },
  { label: 'Personalizado', value: 0 },
]

function FillMeter({ restante, capacidad, alertaOz }: { restante: number; capacidad: number; alertaOz: number }) {
  const pct = capacidad > 0 ? Math.max(0, Math.min(100, (restante / capacidad) * 100)) : 0
  const isAlert = restante <= alertaOz
  const isLow = pct <= 30

  const color = isAlert
    ? 'bg-red-500'
    : isLow
    ? 'bg-yellow-500'
    : 'bg-green-500'

  return (
    <div className="flex items-center gap-3">
      {/* Botella vertical */}
      <div className="relative flex flex-col items-center">
        <div className="w-4 h-1 bg-zinc-700 rounded-t-sm mx-auto" />
        <div className="w-8 h-20 rounded-b-lg border border-zinc-700 bg-zinc-900 overflow-hidden flex flex-col-reverse">
          <div
            className={`${color} w-full transition-all duration-500`}
            style={{ height: `${pct}%` }}
          />
        </div>
      </div>
      {/* Info */}
      <div className="flex flex-col gap-0.5">
        <span className={`text-sm font-bold ${isAlert ? 'text-red-400' : isLow ? 'text-yellow-400' : 'text-green-400'}`}>
          {restante.toFixed(1)} oz
        </span>
        <span className="text-xs text-zinc-500">de {capacidad.toFixed(1)} oz</span>
        <span className="text-xs text-zinc-600">{pct.toFixed(0)}%</span>
        {isAlert && (
          <span className="text-xs font-semibold text-red-400 animate-pulse">⚠ Reponer</span>
        )}
      </div>
    </div>
  )
}

export default function Botellas() {
  const [botellas, setBotellas] = useState<BotellaActiva[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [productId, setProductId] = useState('')
  const [presetIdx, setPresetIdx] = useState(0)
  const [customCap, setCustomCap] = useState('')
  const [alertaOz, setAlertaOz] = useState('3')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const [bRes, pRes] = await Promise.all([
      api.get<BotellaActiva[]>('/botellas'),
      api.get<Product[]>('/products'),
    ])
    setBotellas(bRes.data)
    setProducts(pRes.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const capacidad = presetIdx < PRESETS.length - 1
    ? PRESETS[presetIdx].value
    : parseFloat(customCap) || 0

  async function handleAbrir(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!productId) return setError('Seleccioná un producto')
    if (capacidad <= 0) return setError('Ingresá una capacidad válida')
    setSaving(true)
    try {
      await api.post('/botellas', {
        productId: parseInt(productId),
        capacidad,
        alertaOz: parseFloat(alertaOz) || 3,
      })
      setShowForm(false)
      setProductId('')
      setPresetIdx(0)
      setCustomCap('')
      setAlertaOz('3')
      load()
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Error al abrir botella')
    } finally {
      setSaving(false)
    }
  }

  async function handleCerrar(pid: number, nombre: string) {
    if (!confirm(`¿Cerrar el seguimiento de "${nombre}"?`)) return
    await api.delete(`/botellas/${pid}`)
    load()
  }

  if (loading) return <p className="text-center text-zinc-500">Cargando...</p>

  const alertas = botellas.filter(b => Number(b.restante) <= Number(b.alertaOz))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">Botellas activas</h1>
        <button
          onClick={() => setShowForm(v => !v)}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-black"
        >
          {showForm ? 'Cancelar' : '+ Abrir botella'}
        </button>
      </div>

      {/* Alerta resumen */}
      {alertas.length > 0 && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 flex items-center gap-2">
          <span className="text-red-400 text-lg">⚠</span>
          <span className="text-sm text-red-300 font-medium">
            {alertas.length} botella{alertas.length > 1 ? 's' : ''} por reponer:{' '}
            {alertas.map(b => b.product.name).join(', ')}
          </span>
        </div>
      )}

      {/* Formulario abrir botella */}
      {showForm && (
        <form onSubmit={handleAbrir} className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="font-semibold text-zinc-200">Nueva botella</h2>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">Producto / ingrediente</label>
            <select
              value={productId}
              onChange={e => setProductId(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
              required
            >
              <option value="">— Seleccioná —</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">Tamaño de botella</label>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPresetIdx(i)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    presetIdx === i
                      ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {presetIdx === PRESETS.length - 1 && (
              <input
                type="number"
                step="0.01"
                min="0.1"
                placeholder="Capacidad en oz"
                value={customCap}
                onChange={e => setCustomCap(e.target.value)}
                className="mt-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
                required
              />
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">Alerta cuando queden (oz)</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={alertaOz}
              onChange={e => setAlertaOz(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-500 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Abrir botella'}
          </button>
        </form>
      )}

      {/* Lista de botellas */}
      {botellas.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
          No hay botellas activas
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {botellas.map(b => {
            const restante = Number(b.restante)
            const capacidad = Number(b.capacidad)
            const alertaOz = Number(b.alertaOz)
            const isAlert = restante <= alertaOz
            const pct = capacidad > 0 ? Math.max(0, Math.min(100, (restante / capacidad) * 100)) : 0

            return (
              <div
                key={b.id}
                className={`flex items-center gap-4 rounded-2xl border px-4 py-3 ${
                  isAlert
                    ? 'border-red-900/50 bg-red-950/20'
                    : 'border-zinc-800 bg-zinc-900'
                }`}
              >
                <FillMeter restante={restante} capacidad={capacidad} alertaOz={alertaOz} />

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-zinc-100 truncate">{b.product.name}</p>
                  <p className="text-xs text-zinc-500">{b.product.unit}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    Abierta: {new Date(b.abiertaEn).toLocaleDateString('es-AR')}
                  </p>
                  <div className="mt-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden w-full">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isAlert ? 'bg-red-500' : pct <= 30 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleCerrar(b.productId, b.product.name)}
                  className="ml-2 text-xs text-zinc-600 hover:text-red-400 transition shrink-0"
                  title="Cerrar seguimiento"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
