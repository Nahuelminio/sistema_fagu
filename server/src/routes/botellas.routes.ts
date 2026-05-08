import { Router } from 'express'
import { getBotellas, abrirBotella, cerrarBotella } from '../controllers/botellas.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.use(authenticate)
router.get('/',               asyncHandler(getBotellas))
router.post('/',              requireAdmin, asyncHandler(abrirBotella))
router.delete('/:productId',  requireAdmin, asyncHandler(cerrarBotella))

export default router
