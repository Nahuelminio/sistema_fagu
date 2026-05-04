import { Router } from 'express'
import {
  getProveedores, createProveedor, updateProveedor, deleteProveedor,
  getOrdenes, getOrden, createOrden, recibirOrden, cancelarOrden,
} from '../controllers/ordenes.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()
router.use(authenticate, requireAdmin)

// Proveedores
router.get('/proveedores',      getProveedores)
router.post('/proveedores',     createProveedor)
router.put('/proveedores/:id',  updateProveedor)
router.delete('/proveedores/:id', deleteProveedor)

// Órdenes
router.get('/',           getOrdenes)
router.get('/:id',        getOrden)
router.post('/',          createOrden)
router.post('/:id/recibir',  recibirOrden)
router.post('/:id/cancelar', cancelarOrden)

export default router
