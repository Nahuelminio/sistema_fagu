import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { getClientes, createCliente, updateCliente, deleteCliente } from '../controllers/clientes.controller'

const router = Router()

router.use(authenticate, requireAdmin)
router.get('/',     getClientes)
router.post('/',    createCliente)
router.put('/:id',  updateCliente)
router.delete('/:id', deleteCliente)

export default router
