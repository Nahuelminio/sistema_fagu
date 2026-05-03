import { Router } from 'express'
import { getAll, toggleActive } from '../controllers/users.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate, requireAdmin)
router.get('/', getAll)
router.patch('/:id/toggle', toggleActive)

export default router
