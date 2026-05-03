import { Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { AuthRequest, AuthPayload } from '../types'

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido' })
    return
  }

  const token = header.split(' ')[1]
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}
