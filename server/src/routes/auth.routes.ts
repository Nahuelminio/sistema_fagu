import { Router } from 'express'
import { login, register } from '../controllers/auth.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.post('/login',    asyncHandler(login))
router.post('/register', authenticate, requireAdmin, asyncHandler(register))

export default router
