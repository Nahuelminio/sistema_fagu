import { Router } from 'express'
import { createVenta, getVentas, getRanking, exportVentasCSV } from '../controllers/ventas.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)
router.post('/', createVenta)
router.get('/', requireAdmin, getVentas)
router.get('/ranking', requireAdmin, getRanking)
router.get('/export',  requireAdmin, exportVentasCSV)

export default router
