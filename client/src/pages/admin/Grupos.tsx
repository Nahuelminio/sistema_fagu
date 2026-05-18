import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { ProductGroup } from '../../types'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'

export default function Grupos() {
  const { showToast } = useToast()
  const confirm = useConfirm()
  const [grupos, setGrupos]   = useState<ProductGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ProductGroup | null>(null)
  const [name, setName]       = useState('')
  const [saving, setSaving]   = useState(false)

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get<ProductGroup[]>('/grupos')
      setGrupos(data)
    } catch {
      showToast('Error al cargar grupos', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setName('')
    setShowForm(true)
  }

  function openEdit(g: ProductGroup) {
    setEditing(g)
    setName(g.name)
    setShowForm(true)
  }

  async function handleSave() {
    if (!name.trim()) { showToast('Ingresá un nombre', 'error'); return }
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/grupos/${editing.id}`, { name: name.trim() })
        showToast('Grupo actualizado')
      } else {
        await api.post('/grupos', { name: name.trim() })
        showToast('Grupo creado')
      }
      setShowForm(false)
      load()
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? 'Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(g: ProductGroup) {
    const ok = await confirm({
      title: 'Eliminar grupo',
      message: `¿Eliminar el grupo "${g.name}"? Los productos quedan sin grupo (no se borran).`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/grupos/${g.id}`)
      showToast('Grupo eliminado', 'info')
      load()
    } catch (err: any) {
      showToast(err?.response?.data?.error ?? 'Error al eliminar', 'error')
    }
  }

  if (loading) return <div className="flex h-48 items-center justify-center text-zinc-500">Cargando...</div>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Grupos de productos</h1>
          <p className="text-xs text-zinc-500">Agrupá variantes de una bebida (ej: "Coca-Cola" = Coca 1L + Coca 2.25L)</p>
        </div>
        <Button onClick={openCreate}>+ Nuevo grupo</Button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-zinc-100">{editing ? 'Editar grupo' : 'Nuevo grupo'}</h2>
          <Input
            label="Nombre del grupo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Coca-Cola, Fernet, Gin..."
          />
          <p className="text-[11px] text-zinc-500">
            Después, en cada producto (variante) elegís este grupo. Los tragos que usen
            cualquier variante van a poder consumir de la botella que esté abierta.
          </p>
          <div className="flex gap-2">
            <Button onClick={handleSave} loading={saving}>Guardar</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {grupos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center">
          <p className="text-sm text-zinc-400">No hay grupos todavía</p>
          <p className="mt-1 text-xs text-zinc-600">Creá uno para agrupar variantes (ej: Coca 1L y Coca 2.25L)</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {grupos.map((g) => (
            <div key={g.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-zinc-100">{g.name}</p>
                  {g.products && g.products.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {g.products.map((p) => (
                        <span key={p.id} className="rounded-full bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                          {p.name} · {Number(p.currentStock)} {p.unit}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-zinc-600 italic">Sin productos asignados — asignalos desde la pantalla Productos</p>
                  )}
                </div>
                <div className="flex gap-1 ml-3 shrink-0">
                  <button onClick={() => openEdit(g)} className="rounded-lg px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300">Editar</button>
                  <button onClick={() => handleDelete(g)} className="rounded-lg px-2 py-1.5 text-xs text-zinc-600 hover:bg-red-950/50 hover:text-red-400">Eliminar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
