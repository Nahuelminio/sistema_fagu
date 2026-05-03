import { Request } from 'express'

export interface AuthPayload {
  userId: number
  role: 'ADMIN' | 'USER'
}

export interface AuthRequest extends Request {
  user?: AuthPayload
}
