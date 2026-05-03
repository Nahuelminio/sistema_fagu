import { Router } from 'express'
import { registerIngreso, registerSalida, getHistory } from '../controllers/movements.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)
router.get('/', getHistory)
router.post('/ingreso', requireAdmin, registerIngreso)
router.post('/salida', registerSalida)

export default router
