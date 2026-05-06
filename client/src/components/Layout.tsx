import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const adminLinks = [
  { to: '/dashboard',   label: 'Inicio'      },
  { to: '/venta',       label: 'Venta'       },
  { to: '/ventas',      label: 'Ventas'      },
  { to: '/ranking',     label: 'Ranking'     },
  { to: '/ordenes',     label: 'Compras'     },
  { to: '/resumen',     label: 'Resumen'     },
  { to: '/tragos',      label: 'Tragos'      },
  { to: '/botellas',    label: 'Botellas'    },
  { to: '/productos',   label: 'Productos'   },
  { to: '/movimientos', label: 'Movimientos' },
  { to: '/usuarios',    label: 'Usuarios'    },
]

const userLinks = [
  { to: '/stock',           label: 'Stock'     },
  { to: '/venta',           label: 'Venta'     },
  { to: '/salida',          label: 'Salida'    },
  { to: '/mis-movimientos', label: 'Historial' },
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
          <div className="flex items-center gap-3">
            <span className="text-lg font-black tracking-widest text-zinc-100">FAGU</span>
            <span className="text-xs font-medium tracking-widest text-zinc-600 uppercase">Drink Bar</span>
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
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-24">
        <Outlet />
      </main>

      {/* Bottom nav — scrollable */}
      <nav className="sticky bottom-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto max-w-2xl overflow-x-auto scrollbar-none">
          <div className="flex min-w-max">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 text-xs font-medium tracking-wide transition whitespace-nowrap border-t-2 ${
                    isActive
                      ? 'border-brand-500 text-brand-400'
                      : 'border-transparent text-zinc-600 hover:text-zinc-400'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </div>
  )
}
