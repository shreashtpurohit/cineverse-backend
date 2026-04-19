import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
 
export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
    name: string
  }
  [key: string]: any
}
 
export function authenticate(req: AuthRequest, res: Response, next: NextFunction): any {
  const authHeader = req.headers['authorization'] as string
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }
 
  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as any
    req.user = { id: payload.id, email: payload.email, role: payload.role, name: payload.name }
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
 
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): any {
  const authHeader = req.headers['authorization'] as string
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7)
      const payload = jwt.verify(token, process.env.JWT_SECRET as string) as any
      req.user = { id: payload.id, email: payload.email, role: payload.role, name: payload.name }
    } catch {
      // ignore — optional auth
    }
  }
  next()
}
 
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): any {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' })
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' })
  next()
}
 