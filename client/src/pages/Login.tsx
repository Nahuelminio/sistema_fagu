import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const loggedUser = await login(email, password)
      navigate(loggedUser.role === 'ADMIN' ? '/dashboard' : '/stock')
    } catch {
      setError('Email o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <img
          src="/logo.png"
          alt="FAGU Drink Bar"
          className="mb-4 h-28 w-28 rounded-full object-cover"
          onError={(e) => {
            // fallback si no existe el archivo
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
        <h1 className="text-3xl font-black tracking-widest text-zinc-100">FAGU</h1>
        <p className="mt-0.5 text-xs font-semibold tracking-[0.3em] text-zinc-500 uppercase">
          Drink Bar
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <p className="mb-6 text-center text-sm text-zinc-400">Ingresá a tu cuenta</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@bar.com"
            required
          />
          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            required
          />

          {error && (
            <p className="rounded-lg bg-red-900/30 border border-red-800/50 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} className="mt-2 w-full">
            Ingresar
          </Button>
        </form>
      </div>
    </div>
  )
}
