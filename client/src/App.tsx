import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'

import Login from './pages/Login'
import Catalog from './pages/Catalog'

import Dashboard from './pages/admin/Dashboard'
import Products from './pages/admin/Products'
import Movements from './pages/admin/Movements'
import Users from './pages/admin/Users'
import Ventas from './pages/admin/Ventas'
import Tragos from './pages/admin/Tragos'

import StockView from './pages/user/StockView'
import RegisterSalida from './pages/user/RegisterSalida'
import MyMovements from './pages/user/MyMovements'
import RegisterVenta from './pages/RegisterVenta'

function HomeRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'ADMIN' ? '/dashboard' : '/stock'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/catalogo" element={<Catalog />} />
          <Route path="/" element={<HomeRedirect />} />

          {/* Admin */}
          <Route element={<PrivateRoute requiredRole="ADMIN"><Layout /></PrivateRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/productos" element={<Products />} />
            <Route path="/movimientos" element={<Movements />} />
            <Route path="/ventas" element={<Ventas />} />
            <Route path="/venta" element={<RegisterVenta />} />
            <Route path="/tragos" element={<Tragos />} />
            <Route path="/usuarios" element={<Users />} />
          </Route>

          {/* Usuario */}
          <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route path="/stock" element={<StockView />} />
            <Route path="/venta" element={<RegisterVenta />} />
            <Route path="/salida" element={<RegisterSalida />} />
            <Route path="/mis-movimientos" element={<MyMovements />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
