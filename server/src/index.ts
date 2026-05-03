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
import { errorHandler } from './middlewares/error.middleware'

const app = express()
const isProd = process.env.NODE_ENV === 'production'

app.use(cors({ origin: isProd ? '*' : (process.env.CLIENT_URL ?? '*') }))
app.use(express.json())

// API routes
app.use('/auth', authRoutes)
app.use('/products', productRoutes)
app.use('/movements', movementRoutes)
app.use('/catalogo', catalogRoutes)
app.use('/dashboard', dashboardRoutes)
app.use('/users', userRoutes)
app.use('/categories', categoryRoutes)

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
