import { Router } from 'express'
import { getBotellas, abrirBotella, cerrarBotella } from '../controllers/botellas.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)
router.get('/', getBotellas)
router.post('/', requireAdmin, abrirBotella)
router.delete('/:productId', requireAdmin, cerrarBotella)

export default router
