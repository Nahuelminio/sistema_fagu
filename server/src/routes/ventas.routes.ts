import { Router } from 'express'
import { createVenta, getVentas, getRanking, exportVentasCSV } from '../controllers/ventas.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.use(authenticate)
router.post('/',          asyncHandler(createVenta))
router.get('/',           requireAdmin, asyncHandler(getVentas))
router.get('/ranking',    requireAdmin, asyncHandler(getRanking))
router.get('/export',     requireAdmin, asyncHandler(exportVentasCSV))

export default router
