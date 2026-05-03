import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Role } from '../types'

interface Props {
  children: React.ReactNode
  requiredRole?: Role
}

export default function PrivateRoute({ children, requiredRole }: Props) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />
  if (requiredRole && user.role !== requiredRole) return <Navigate to="/" replace />

  return <>{children}</>
}
