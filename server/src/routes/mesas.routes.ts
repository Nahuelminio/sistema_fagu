import { Router } from 'express'
import {
  getMesas, createMesa, deleteMesa,
  getComanda, openComanda, addItemToComanda, removeItemFromComanda, cerrarComanda,
} from '../controllers/mesas.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)

// Mesas
router.get('/',       getMesas)
router.post('/',      requireAdmin, createMesa)
router.delete('/:id', requireAdmin, deleteMesa)

// Comandas por mesa
router.post('/:mesaId/comanda', openComanda)

// Comanda operations
router.get('/comanda/:id',                      getComanda)
router.post('/comanda/:id/items',               addItemToComanda)
router.delete('/comanda/:id/items/:itemId',     removeItemFromComanda)
router.post('/comanda/:id/cerrar',              cerrarComanda)

export default router
