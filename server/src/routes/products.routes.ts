import { Router } from 'express'
import { getAll, getOne, create, update, remove, mergeProducts } from '../controllers/products.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.use(authenticate)
router.get('/',           asyncHandler(getAll))
router.get('/:id',        asyncHandler(getOne))
router.post('/merge',     requireAdmin, asyncHandler(mergeProducts))
router.post('/',          requireAdmin, asyncHandler(create))
router.put('/:id',        requireAdmin, asyncHandler(update))
router.delete('/:id',     requireAdmin, asyncHandler(remove))

export default router
