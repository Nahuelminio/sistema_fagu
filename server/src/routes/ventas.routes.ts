import { Router } from 'express'
import { createVenta, getVentas } from '../controllers/ventas.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)
router.post('/', createVenta)
router.get('/', requireAdmin, getVentas)

export default router
