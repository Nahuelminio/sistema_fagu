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
    id: number; name: string; unit: string
    currentStock: string; minStock: string
    category: { name: string }
  }>
  today: { count: number; revenue: number }
  month: { costoCompras: number; ventas: number; ganancia: number }
  weekSales: Array<{ date: string; revenue: number; count: number }>
  topItems: Array<{ nombre: string; qty: number; revenue: number }>
  paymentBreakdown: Array<{ method: string; count: number; total: number }>
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

export interface TragoBotella {
  id: number
  productId: number
  cantidad: string
  product: {
    id: number; name: string; unit: string; currentStock: string; costPrice: string | null
    botellaActiva: { capacidad: string } | null
  }
}

export interface Trago {
  id: number
  name: string
  salePrice: string | null
  active: boolean
  createdAt: string
  ingredientes: TragoBotella[]
}

export interface SaleItem {
  id: number
  productId: number | null
  tragoId: number | null
  nombre: string
  quantity: string
  unitPrice: string
  product: { id: number; name: string; unit: string } | null
  trago: { id: number; name: string } | null
}

export type PaymentMethod = 'EFECTIVO' | 'DEBITO' | 'CREDITO' | 'TRANSFERENCIA' | 'MERCADOPAGO' | 'CUENTA_CORRIENTE'

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  EFECTIVO: 'Efectivo',
  DEBITO: 'Débito',
  CREDITO: 'Crédito',
  TRANSFERENCIA: 'Transferencia',
  MERCADOPAGO: 'MercadoPago',
  CUENTA_CORRIENTE: 'Cuenta corriente',
}

export interface Sale {
  id: number
  subtotal?: string
  discount?: string
  total: string
  paymentMethod: PaymentMethod
  notes: string | null
  createdAt: string
  user: { id: number; name: string }
  items: SaleItem[]
  cae?: string | null
  caeVencimiento?: string | null
  nroFactura?: number | null
  puntoVenta?: number | null
  cliente?: { id: number; nombre: string; cuit?: string | null; dni?: string | null } | null
}

export interface VentasResponse {
  ventas: Sale[]
  total: number
  page: number
  pages: number
  totalRevenue: number
}

export interface BotellaActiva {
  id: number
  productId: number
  capacidad: string
  restante: string
  alertaOz: string
  abiertaEn: string
  updatedAt: string
  product: { id: number; name: string; unit: string }
}
