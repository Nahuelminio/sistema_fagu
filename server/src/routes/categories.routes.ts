import { Router } from 'express'
import { getAll, create, remove } from '../controllers/categories.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)
router.get('/', getAll)
router.post('/', requireAdmin, create)
router.delete('/:id', requireAdmin, remove)

export default router
