import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const adminLinks = [
  { to: '/dashboard',   label: 'Dashboard',   icon: '📊' },
  { to: '/venta',       label: 'Nueva venta', icon: '🛒' },
  { to: '/ventas',      label: 'Ventas',      icon: '💰' },
  { to: '/tragos',      label: 'Tragos',      icon: '🍹' },
  { to: '/botellas',    label: 'Botellas',    icon: '🫙' },
  { to: '/productos',   label: 'Productos',   icon: '📦' },
  { to: '/movimientos', label: 'Movimientos', icon: '🔄' },
  { to: '/usuarios',    label: 'Usuarios',    icon: '👥' },
]

const userLinks = [
  { to: '/stock',           label: 'Stock',       icon: '📦' },
  { to: '/venta',           label: 'Nueva venta', icon: '🛒' },
  { to: '/salida',          label: 'Salida',      icon: '➖' },
  { to: '/mis-movimientos', label: 'Mis mov.',    icon: '📋' },
]

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const links = isAdmin ? adminLinks : userLinks

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-brand-500 text-lg">⚡</span>
            <span className="text-lg font-black tracking-wider text-zinc-100">FAGU</span>
            <span className="text-xs font-medium tracking-widest text-zinc-500 uppercase">Drink Bar</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-zinc-600 hover:text-red-400 transition"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="sticky bottom-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl justify-around">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-medium transition ${
                  isActive
                    ? 'text-brand-400'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`
              }
            >
              <span className="text-lg leading-none">{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
