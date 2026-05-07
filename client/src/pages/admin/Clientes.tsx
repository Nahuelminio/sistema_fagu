import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import Button from '../../components/ui/Button'

interface Cliente {
  id:      number
  nombre:  string
  cuit?:   string | null
  dni?:    string | null
  email?:  string | null
  phone?:  string | null
  address?: string | null
}

const inputClass = 'w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-brand-500'

export default function Clientes() {
  const { showToast } = useToast()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [search, setSearch]     = useState('')
  const [editing, setEditing]   = useState<Cliente | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)

  const empty = { nombre: '', cuit: '', dni: '', email: '', phone: '', address: '' }
  const [form, setForm] = useState(empty)

  async function load() {
    const r = await api.get<Cliente[]>('/clientes')
    setClientes(r.data)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm(empty)
    setShowForm(true)
  }

  function openEdit(c: Cliente) {
    setEditing(c)
    setForm({
      nombre:  c.nombre,
      cuit:    c.cuit  ?? '',
      dni:     c.dni   ?? '',
      email:   c.email ?? '',
      phone:   c.phone ?? '',
      address: c.address ?? '',
    })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      const body = {
        nombre:  form.nombre.trim(),
        cuit:    form.cuit.trim()    || undefined,
        dni:     form.dni.trim()     || undefined,
        email:   form.email.trim()   || undefined,
        phone:   form.phone.trim()   || undefined,
        address: form.address.trim() || undefined,
      }
      if (editing) {
        await api.put(`/clientes/${editing.id}`, body)
        showToast('Cliente actualizado')
      } else {
        await api.post('/clientes', body)
        showToast('Cliente creado')
      }
      setShowForm(false)
      load()
    } catch {
      showToast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.delete(`/clientes/${id}`)
      showToast('Cliente eliminado')
      load()
    } catch {
      showToast('Error al eliminar', 'error')
    }
  }

  const filtered = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.cuit ?? '').includes(search) ||
    (c.dni  ?? '').includes(search)
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-zinc-100">Clientes</h1>
        <Button onClick={openNew}>+ Nuevo</Button>
      </div>

      <input
        type="text"
        placeholder="Buscar por nombre, CUIT o DNI..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={inputClass}
      />

      {/* Formulario */}
      {showForm && (
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-zinc-300">
            {editing ? 'Editar cliente' : 'Nuevo cliente'}
          </p>

          <input className={inputClass} placeholder="Nombre o razon social *"
            value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />

          <div className="grid grid-cols-2 gap-2">
            <input className={inputClass} placeholder="CUIT (para factura A/B)"
              value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} />
            <input className={inputClass} placeholder="DNI (para factura C)"
              value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input className={inputClass} placeholder="Email" type="email"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className={inputClass} placeholder="Telefono"
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>

          <input className={inputClass} placeholder="Direccion"
            value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />

          <div className="flex gap-2">
            <Button onClick={handleSave} loading={saving} className="flex-1">
              {editing ? 'Guardar cambios' : 'Crear cliente'}
            </Button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-600">
          {search ? 'Sin resultados' : 'No hay clientes cargados'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((c) => (
            <div key={c.id} className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-100">{c.nombre}</p>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {c.cuit    && <span className="text-xs text-zinc-500">CUIT: {c.cuit}</span>}
                  {c.dni     && <span className="text-xs text-zinc-500">DNI: {c.dni}</span>}
                  {c.email   && <span className="text-xs text-zinc-500">{c.email}</span>}
                  {c.phone   && <span className="text-xs text-zinc-500">{c.phone}</span>}
                  {c.address && <span className="text-xs text-zinc-500 truncate">{c.address}</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(c)}
                  className="text-xs text-zinc-500 hover:text-zinc-200 transition">
                  Editar
                </button>
                <button onClick={() => handleDelete(c.id)}
                  className="text-xs text-zinc-600 hover:text-red-400 transition">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
