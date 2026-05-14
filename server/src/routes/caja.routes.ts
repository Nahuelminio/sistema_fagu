import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { asyncHandler } from '../utils/asyncHandler'
import {
  getCajaActual, abrirCaja, cerrarCaja, reabrirCaja,
  getHistorialCajas, getCierreDetalle,
  registrarMovimiento, deleteMovimiento,
} from '../controllers/caja.controller'

const router = Router()
router.use(authenticate)

router.get('/actual',          asyncHandler(getCajaActual))
router.post('/abrir',          asyncHandler(abrirCaja))
router.post('/cerrar',         asyncHandler(cerrarCaja))
router.post('/movimiento',     asyncHandler(registrarMovimiento))
router.delete('/movimiento/:id', requireAdmin, asyncHandler(deleteMovimiento))

router.get('/historial',       requireAdmin, asyncHandler(getHistorialCajas))
router.get('/:id',             requireAdmin, asyncHandler(getCierreDetalle))
router.post('/:id/reabrir',    requireAdmin, asyncHandler(reabrirCaja))

export default router
