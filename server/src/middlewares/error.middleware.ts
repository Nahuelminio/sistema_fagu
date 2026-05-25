import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

interface HttpError extends Error {
  status?: number
  statusCode?: number
  code?: string
}

export function errorHandler(err: HttpError, _req: Request, res: Response, _next: NextFunction): void {
  // Zod: validación → 400 con detalles
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Datos inválidos', details: err.flatten() })
    return
  }

  // Prisma "not found" → 404
  if (err.code === 'P2025') {
    res.status(404).json({ error: 'Recurso no encontrado' })
    return
  }
  // Prisma unique constraint → 400
  if (err.code === 'P2002') {
    res.status(400).json({ error: 'Ya existe un registro con esos datos' })
    return
  }

  const status = err.status ?? err.statusCode ?? 500
  if (status >= 500) {
    console.error('[errorHandler]', err.stack ?? err)
  }
  res.status(status).json({
    error: status >= 500 ? 'Error interno del servidor' : (err.message || 'Error'),
  })
}
