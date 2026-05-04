import { Router } from 'express'
import { getDashboard, getCierreCaja } from '../controllers/dashboard.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.get('/', authenticate, requireAdmin, getDashboard)
router.get('/cierre', authenticate, requireAdmin, getCierreCaja)

export default router
