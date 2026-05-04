import { Router } from 'express'
import { getAll, getOne, create, update, remove, mergeProducts } from '../controllers/products.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)
router.get('/', getAll)
router.get('/:id', getOne)
router.post('/', requireAdmin, create)
router.put('/:id', requireAdmin, update)
router.delete('/:id', requireAdmin, remove)
router.post('/merge', requireAdmin, mergeProducts)

export default router
