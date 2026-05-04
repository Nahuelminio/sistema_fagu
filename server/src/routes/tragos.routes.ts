import { Router } from 'express'
import { getTragos, createTrago, updateTrago, deleteTrago } from '../controllers/tragos.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)
router.get('/', getTragos)
router.post('/', requireAdmin, createTrago)
router.put('/:id', requireAdmin, updateTrago)
router.delete('/:id', requireAdmin, deleteTrago)

export default router
