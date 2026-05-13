import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const adminLinks = [
  { to: '/dashboard',   label: 'Inicio'        },
  { to: '/caja',        label: 'Caja'          },
  { to: '/venta',       label: 'Cobrar'        },
  { to: '/mesas',       label: 'Mesas'         },
  { to: '/ventas',      label: 'Historial'     },
  { to: '/ranking',     label: 'Más vendidos'  },
  { to: '/ordenes',     label: 'Pedidos'       },
  { to: '/resumen',     label: 'Ganancias'     },
  { to: '/tragos',      label: 'Tragos'        },
  { to: '/botellas',    label: 'Botellas'      },
  { to: '/productos',   label: 'Productos'     },
  { to: '/movimientos', label: 'Inventario'    },
  { to: '/clientes',    label: 'Clientes'      },
  { to: '/usuarios',    label: 'Empleados'     },
]

const userLinks = [
  { to: '/stock',           label: 'Ver stock'      },
  { to: '/caja',            label: 'Caja'           },
  { to: '/venta',           label: 'Cobrar'         },
  { to: '/mesas',           label: 'Mesas'          },
  { to: '/salida',          label: 'Consumo interno'},
  { to: '/mis-movimientos', label: 'Mi historial'   },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-4 py-3 text-base font-medium transition ${
    isActive
      ? 'bg-zinc-800 text-brand-400'
      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
  }`

const bottomLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center px-5 py-4 text-sm font-semibold tracking-wide transition whitespace-nowrap border-t-2 ${
    isActive
      ? 'border-brand-500 text-brand-400'
      : 'border-transparent text-zinc-500 hover:text-zinc-300'
  }`

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const links = isAdmin ? adminLinks : userLinks

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 md:flex-row">

      {/* ── Sidebar (solo desktop) ─────────────────────────────────────── */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:shrink-0 md:sticky md:top-0 md:h-screen border-r border-zinc-800 bg-zinc-950">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-zinc-800">
          <span className="text-xl font-black tracking-widest text-zinc-100">FAGU</span>
          <span className="ml-2 text-sm font-medium tracking-widest text-zinc-600 uppercase">Bar</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="px-4 py-4 border-t border-zinc-800">
          <p className="text-sm text-zinc-400 truncate mb-2 font-medium">{user?.name}</p>
          <button
            onClick={handleLogout}
            className="text-sm text-zinc-500 hover:text-red-400 transition font-medium"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Columna principal ──────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">

        {/* Header (solo mobile) */}
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 px-4 py-4 backdrop-blur md:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl font-black tracking-widest text-zinc-100">FAGU</span>
              <span className="text-sm font-medium tracking-widest text-zinc-600 uppercase">Drink Bar</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-400 font-medium">{user?.name}</span>
              <button onClick={handleLogout} className="text-sm text-zinc-500 hover:text-red-400 transition font-medium">
                Salir
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-4 pt-6 pb-24 md:pb-8 md:px-8 md:pt-8">
          <Outlet />
        </main>

        {/* Bottom nav (solo mobile) */}
        <nav className="sticky bottom-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur md:hidden">
          <div className="overflow-x-auto scrollbar-none">
            <div className="flex min-w-max">
              {links.map((link) => (
                <NavLink key={link.to} to={link.to} className={bottomLinkClass}>
                  {link.label}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

      </div>
    </div>
  )
}
