import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'

// Validate required env vars at startup
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set')
  process.exit(1)
}

import authRoutes from './routes/auth.routes'
import productRoutes from './routes/products.routes'
import movementRoutes from './routes/movements.routes'
import catalogRoutes from './routes/catalog.routes'
import dashboardRoutes from './routes/dashboard.routes'
import userRoutes from './routes/users.routes'
import categoryRoutes from './routes/categories.routes'
import ventasRoutes from './routes/ventas.routes'
import tragosRoutes from './routes/tragos.routes'
import botellasRoutes from './routes/botellas.routes'
import mesasRoutes from './routes/mesas.routes'
import ordenesRoutes from './routes/ordenes.routes'
import gastosRoutes from './routes/gastos.routes'
import clientesRoutes from './routes/clientes.routes'
import cajaRoutes from './routes/caja.routes'
import groupsRoutes from './routes/groups.routes'
import { errorHandler } from './middlewares/error.middleware'

const app = express()
const isProd = process.env.NODE_ENV === 'production'

// Si estamos detrás de un proxy (Railway), confiar en X-Forwarded-* para rate-limit por IP real
if (isProd) app.set('trust proxy', 1)

// Seguridad base
app.use(helmet({
  // El frontend ya es servido por la misma app y carga assets locales; CSP por defecto puede romper Vite/preview.
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}))

// CORS: use explicit origin in production if set, otherwise allow all for dev
const corsOrigin = process.env.CORS_ORIGIN ?? (isProd ? false : '*')
app.use(cors({ origin: corsOrigin }))

// Limit request body to 1 MB to prevent abuse
app.use(express.json({ limit: '1mb' }))

// Rate-limit específico para login: 10 intentos / 15 min por IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de login. Esperá unos minutos.' },
})

// API routes
app.use('/api/auth/login', loginLimiter)
app.use('/api/auth',       authRoutes)
app.use('/api/products',   productRoutes)
app.use('/api/movements',  movementRoutes)
app.use('/api/catalogo',   catalogRoutes)
app.use('/api/dashboard',  dashboardRoutes)
app.use('/api/users',      userRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/ventas',     ventasRoutes)
app.use('/api/tragos',     tragosRoutes)
app.use('/api/botellas',   botellasRoutes)
app.use('/api/mesas',      mesasRoutes)
app.use('/api/ordenes',    ordenesRoutes)
app.use('/api/gastos',     gastosRoutes)
app.use('/api/clientes',   clientesRoutes)
app.use('/api/caja',       cajaRoutes)
app.use('/api/grupos',     groupsRoutes)

app.use(errorHandler)

// En producción sirve el frontend compilado
if (isProd) {
  const clientDist = path.join(__dirname, '../../client/dist')
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

const PORT = process.env.PORT ?? 3001
const BUILD_TAG = 'v2-' + Date.now()
app.listen(PORT, () => console.log(`Server running on port ${PORT} (${BUILD_TAG})`))
