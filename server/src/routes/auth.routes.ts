import { Router } from 'express'
import { login, register } from '../controllers/auth.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.post('/login', login)
router.post('/register', authenticate, requireAdmin, register)

export default router
