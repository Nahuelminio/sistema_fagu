import { Router } from 'express'
import {
  getMesas, createMesa, deleteMesa,
  getComanda, openComanda, addItemToComanda, removeItemFromComanda, cerrarComanda,
} from '../controllers/mesas.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.use(authenticate)

// Mesas — cualquier usuario puede crear cuentas (sobre la marcha); solo admin elimina
router.get('/',       asyncHandler(getMesas))
router.post('/',      asyncHandler(createMesa))
router.delete('/:id', requireAdmin, asyncHandler(deleteMesa))

// Comandas por mesa
router.post('/:mesaId/comanda', asyncHandler(openComanda))

// Comanda operations
router.get('/comanda/:id',                  asyncHandler(getComanda))
router.post('/comanda/:id/items',           asyncHandler(addItemToComanda))
router.delete('/comanda/:id/items/:itemId', asyncHandler(removeItemFromComanda))
router.post('/comanda/:id/cerrar',          asyncHandler(cerrarComanda))

export default router
