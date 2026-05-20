import { Router, Request, Response } from 'express'
import { createVenta, getVentas, getRanking, exportVentasCSV, anularVenta, reintentarNotaCredito } from '../controllers/ventas.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { asyncHandler } from '../utils/asyncHandler'
import { testArca } from '../services/arca.service'

const router = Router()

router.use(authenticate)
router.post('/',           asyncHandler(createVenta))
router.get('/',            requireAdmin, asyncHandler(getVentas))
router.get('/ranking',     requireAdmin, asyncHandler(getRanking))
router.get('/export',      requireAdmin, asyncHandler(exportVentasCSV))
router.get('/arca-test',   requireAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const result = await testArca()
  res.json(result)
}))
router.post('/:id/anular',   requireAdmin, asyncHandler(anularVenta))
router.post('/:id/retry-nc', requireAdmin, asyncHandler(reintentarNotaCredito))

export default router
