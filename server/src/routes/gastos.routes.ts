import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { getResumenMensual, createGasto, deleteGasto } from '../controllers/gastos.controller'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.use(authenticate, requireAdmin)
router.get('/resumen', asyncHandler(getResumenMensual))
router.post('/',       asyncHandler(createGasto))
router.delete('/:id',  asyncHandler(deleteGasto))

export default router
