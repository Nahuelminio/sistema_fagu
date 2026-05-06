import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'

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
import { errorHandler } from './middlewares/error.middleware'

const app = express()
const isProd = process.env.NODE_ENV === 'production'

app.use(cors({ origin: isProd ? '*' : (process.env.CLIENT_URL ?? '*') }))
app.use(express.json())

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/movements', movementRoutes)
app.use('/api/catalogo', catalogRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/users', userRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/ventas', ventasRoutes)
app.use('/api/tragos', tragosRoutes)
app.use('/api/botellas', botellasRoutes)
app.use('/api/mesas', mesasRoutes)
app.use('/api/ordenes', ordenesRoutes)
app.use('/api/gastos',  gastosRoutes)

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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
