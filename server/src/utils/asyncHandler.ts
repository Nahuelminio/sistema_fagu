import { Request, Response, NextFunction } from 'express'

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>

/**
 * Wraps an async route handler so unhandled rejections are forwarded to
 * Express errorHandler instead of hanging indefinitely.
 */
export const asyncHandler = (fn: AsyncFn) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }

/**
 * Validates and parses a numeric route param (req.params.id).
 * Returns the number or null if invalid.
 */
export function parseId(param: string): number | null {
  const n = parseInt(param, 10)
  return isNaN(n) || n <= 0 ? null : n
}

/**
 * Validates a date string — returns a Date or null if invalid.
 */
export function parseDate(s: string): Date | null {
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}
