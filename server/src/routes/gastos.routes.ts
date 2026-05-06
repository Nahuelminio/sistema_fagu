import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { getResumenMensual, createGasto, deleteGasto } from '../controllers/gastos.controller'

const router = Router()

router.use(authenticate, requireAdmin)

router.get('/resumen', getResumenMensual)
router.post('/',       createGasto)
router.delete('/:id',  deleteGasto)

export default router
