import { Router } from 'express'
import { getAll, toggleActive } from '../controllers/users.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.use(authenticate, requireAdmin)
router.get('/',              asyncHandler(getAll))
router.patch('/:id/toggle',  asyncHandler(toggleActive))

export default router
