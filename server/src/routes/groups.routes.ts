import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { asyncHandler } from '../utils/asyncHandler'
import { getGroups, createGroup, updateGroup, deleteGroup } from '../controllers/groups.controller'

const router = Router()
router.use(authenticate)

router.get('/',       asyncHandler(getGroups))
router.post('/',      requireAdmin, asyncHandler(createGroup))
router.put('/:id',    requireAdmin, asyncHandler(updateGroup))
router.delete('/:id', requireAdmin, asyncHandler(deleteGroup))

export default router
