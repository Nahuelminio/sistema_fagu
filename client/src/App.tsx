import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { ConfirmProvider } from './context/ConfirmContext'
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
import Botellas from './pages/admin/Botellas'
import CierreCaja from './pages/admin/CierreCaja'
import Ranking from './pages/admin/Ranking'
import ProductHistory from './pages/admin/ProductHistory'
import Mesas from './pages/admin/Mesas'
import Ordenes from './pages/admin/Ordenes'
import ResumenMensual from './pages/admin/ResumenMensual'
import Clientes from './pages/admin/Clientes'
import Caja from './pages/Caja'

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
      <ToastProvider>
      <ConfirmProvider>
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
            <Route path="/botellas" element={<Botellas />} />
            <Route path="/cierre" element={<CierreCaja />} />
            <Route path="/ranking" element={<Ranking />} />
            <Route path="/productos/:id/historial" element={<ProductHistory />} />
            <Route path="/mesas" element={<Mesas />} />
            <Route path="/ordenes" element={<Ordenes />} />
            <Route path="/resumen" element={<ResumenMensual />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/caja" element={<Caja />} />
            <Route path="/usuarios" element={<Users />} />
          </Route>

          {/* Usuario */}
          <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route path="/stock" element={<StockView />} />
            <Route path="/venta" element={<RegisterVenta />} />
            <Route path="/mesas" element={<Mesas />} />
            <Route path="/caja" element={<Caja />} />
            <Route path="/salida" element={<RegisterSalida />} />
            <Route path="/mis-movimientos" element={<MyMovements />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
