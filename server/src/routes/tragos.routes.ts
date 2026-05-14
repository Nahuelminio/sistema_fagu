import { Router } from 'express'
import { getTragos, createTrago, updateTrago, deleteTrago, toggleCatalogTrago } from '../controllers/tragos.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.use(authenticate)
router.get('/',                     asyncHandler(getTragos))
router.post('/',                    requireAdmin, asyncHandler(createTrago))
router.put('/:id',                  requireAdmin, asyncHandler(updateTrago))
router.patch('/:id/toggle-catalog', requireAdmin, asyncHandler(toggleCatalogTrago))
router.delete('/:id',               requireAdmin, asyncHandler(deleteTrago))

export default router
