import { Router } from 'express'
import { getCatalog, catalogSSE } from '../controllers/catalog.controller'

const router = Router()

router.get('/', getCatalog)
router.get('/events', catalogSSE)

export default router
