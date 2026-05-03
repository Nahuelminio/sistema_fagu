import { Router } from 'express'
import { getDashboard } from '../controllers/dashboard.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.get('/', authenticate, requireAdmin, getDashboard)

export default router
