import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { asyncHandler } from '../utils/asyncHandler'
import {
  getCajaActual, abrirCaja, cerrarCaja, reabrirCaja, getHistorialCajas,
} from '../controllers/caja.controller'

const router = Router()
router.use(authenticate)

// Operaciones de caja — accesibles para cualquier usuario logueado
router.get('/actual',  asyncHandler(getCajaActual))
router.post('/abrir',  asyncHandler(abrirCaja))
router.post('/cerrar', asyncHandler(cerrarCaja))

// Solo admin
router.get('/historial',       requireAdmin, asyncHandler(getHistorialCajas))
router.post('/:id/reabrir',    requireAdmin, asyncHandler(reabrirCaja))

export default router
