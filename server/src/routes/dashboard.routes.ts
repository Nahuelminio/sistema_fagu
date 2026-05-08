import { Router } from 'express'
import { getDashboard, getCierreCaja } from '../controllers/dashboard.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.get('/',       authenticate, requireAdmin, asyncHandler(getDashboard))
router.get('/cierre', authenticate, requireAdmin, asyncHandler(getCierreCaja))

export default router
