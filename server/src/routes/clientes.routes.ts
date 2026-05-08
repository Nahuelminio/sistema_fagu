import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { getClientes, createCliente, updateCliente, deleteCliente } from '../controllers/clientes.controller'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.use(authenticate, requireAdmin)
router.get('/',       asyncHandler(getClientes))
router.post('/',      asyncHandler(createCliente))
router.put('/:id',    asyncHandler(updateCliente))
router.delete('/:id', asyncHandler(deleteCliente))

export default router
