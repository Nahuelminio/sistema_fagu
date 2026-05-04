import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const adminLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/productos', label: 'Productos', icon: '📦' },
  { to: '/venta', label: 'Nueva venta', icon: '🛒' },
  { to: '/ventas', label: 'Ventas', icon: '💰' },
  { to: '/movimientos', label: 'Movimientos', icon: '🔄' },
  { to: '/usuarios', label: 'Usuarios', icon: '👥' },
]

const userLinks = [
  { to: '/stock', label: 'Stock', icon: '📦' },
  { to: '/venta', label: 'Nueva venta', icon: '🛒' },
  { to: '/salida', label: 'Salida', icon: '➖' },
  { to: '/mis-movimientos', label: 'Mis mov.', icon: '📋' },
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
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <span className="text-lg font-bold text-brand-600">StockBar</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user?.name}</span>
            <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-red-500">
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      {/* Bottom nav — mobile first */}
      <nav className="sticky bottom-0 border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl justify-around">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-medium transition ${
                  isActive ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'
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
