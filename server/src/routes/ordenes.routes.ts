import { Router } from 'express'
import {
  getProveedores, createProveedor, updateProveedor, deleteProveedor,
  getOrdenes, getOrden, createOrden, recibirOrden, cancelarOrden,
} from '../controllers/ordenes.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()
router.use(authenticate, requireAdmin)

// Proveedores
router.get('/proveedores',          asyncHandler(getProveedores))
router.post('/proveedores',         asyncHandler(createProveedor))
router.put('/proveedores/:id',      asyncHandler(updateProveedor))
router.delete('/proveedores/:id',   asyncHandler(deleteProveedor))

// Órdenes
router.get('/',              asyncHandler(getOrdenes))
router.get('/:id',           asyncHandler(getOrden))
router.post('/',             asyncHandler(createOrden))
router.post('/:id/recibir',  asyncHandler(recibirOrden))
router.post('/:id/cancelar', asyncHandler(cancelarOrden))

export default router
