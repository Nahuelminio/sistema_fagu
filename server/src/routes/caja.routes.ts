import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { asyncHandler } from '../utils/asyncHandler'
import {
  getCajaActual, abrirCaja, cerrarCaja, getHistorialCajas,
} from '../controllers/caja.controller'

const router = Router()
router.use(authenticate)

router.get('/actual',      asyncHandler(getCajaActual))
router.post('/abrir',      asyncHandler(abrirCaja))
router.post('/cerrar',     asyncHandler(cerrarCaja))
router.get('/historial',   asyncHandler(getHistorialCajas))

export default router
