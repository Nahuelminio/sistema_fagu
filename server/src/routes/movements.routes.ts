import { Router } from 'express'
import { registerIngreso, registerSalida, getHistory } from '../controllers/movements.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.use(authenticate)
router.get('/',           asyncHandler(getHistory))
router.post('/ingreso',   requireAdmin, asyncHandler(registerIngreso))
router.post('/salida',    asyncHandler(registerSalida))

export default router
