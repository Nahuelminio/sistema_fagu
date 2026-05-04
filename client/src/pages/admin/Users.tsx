import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { User } from '../../types'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import { useAuth } from '../../context/AuthContext'

const selectClass = 'w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-brand-500'

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'USER' })
  const [saving, setSaving] = useState(false)
  const { user: me } = useAuth()

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await api.get<User[]>('/users')
    setUsers(data)
  }

  async function handleCreate() {
    setSaving(true)
    try {
      await api.post('/auth/register', form)
      setShowForm(false)
      setForm({ name: '', email: '', password: '', role: 'USER' })
      load()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(id: number) {
    await api.patch(`/users/${id}/toggle`)
    load()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">Usuarios</h1>
        <Button onClick={() => setShowForm(true)}>+ Nuevo</Button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 font-semibold text-zinc-100">Nuevo usuario</h2>
          <div className="flex flex-col gap-3">
            <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Contraseña" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-400">Rol</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={selectClass}>
                <option value="USER">Usuario</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} loading={saving}>Crear</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <div>
              <p className="font-medium text-zinc-100">{u.name}</p>
              <p className="text-xs text-zinc-500">{u.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge label={u.role} color={u.role === 'ADMIN' ? 'orange' : 'gray'} />
              {!u.active && <Badge label="Inactivo" color="red" />}
              {u.id !== me?.id && (
                <button
                  onClick={() => toggleActive(u.id)}
                  className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                    u.active
                      ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                      : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                  }`}
                >
                  {u.active ? 'Desactivar' : 'Activar'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
