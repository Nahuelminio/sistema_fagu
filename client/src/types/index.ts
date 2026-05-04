export type Role = 'ADMIN' | 'USER'
export type MovementType = 'INGRESO' | 'SALIDA' | 'AJUSTE'

export interface User {
  id: number
  name: string
  email: string
  role: Role
  active?: boolean
  createdAt?: string
}

export interface Category {
  id: number
  name: string
}

export interface Product {
  id: number
  name: string
  unit: string
  currentStock: string
  minStock: string
  costPrice: string | null
  salePrice: string | null
  visibleInCatalog: boolean
  createdAt: string
  updatedAt: string
  category: Category
}

export interface StockMovement {
  id: number
  type: MovementType
  quantity: string
  unitCost: string | null
  notes: string | null
  createdAt: string
  product: { id: number; name: string; unit: string }
  user: { id: number; name: string }
}

export interface DashboardData {
  totalProducts: number
  lowStockProducts: Array<{
    id: number
    name: string
    unit: string
    currentStock: string
    minStock: string
    category: { name: string }
  }>
  todayMovements: number
  month: {
    costoCompras: number
    ventasEstimadas: number
    gananciaEstimada: number
  }
}

export interface CatalogProduct {
  id: number
  name: string
  unit: string
  currentStock: string
  salePrice: string | null
  category: Category
}

export interface CatalogResponse {
  categories: Record<string, CatalogProduct[]>
  updatedAt: string
}

export interface MovementsResponse {
  movements: StockMovement[]
  total: number
  page: number
  pages: number
}

export interface SaleItem {
  id: number
  productId: number
  quantity: string
  unitPrice: string
  product: { id: number; name: string; unit: string }
}

export interface Sale {
  id: number
  total: string
  notes: string | null
  createdAt: string
  user: { id: number; name: string }
  items: SaleItem[]
}

export interface VentasResponse {
  ventas: Sale[]
  total: number
  page: number
  pages: number
  totalRevenue: number
}
