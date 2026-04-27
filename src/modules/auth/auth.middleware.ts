import { Request, Response, NextFunction } from 'express'
import { AuthService } from './auth.service'
import { firebaseAuth } from '../../config/firebase'
import { AuthenticatedRequest, JWTPayload } from './types'

export class AuthMiddleware {
  // Define public routes that don't require authentication
  private publicRoutes = [
    '/health',
    '/api/auth/register',
    '/api/auth/login',
    '/api/auth/exchange',
    '/api/auth/refresh-token',
    '/api-docs'
  ]

  constructor(private authService: AuthService) {}

  globalAuthChecker = (req: Request, res: Response, next: NextFunction) => {
    // Check if current path matches any of the public routes
    const isPublic = this.publicRoutes.some(route => req.path.startsWith(route))

    if (isPublic) {
      return next()
    }

    // Call authenticate for protected routes
    return this.authenticate(req as AuthenticatedRequest, res, next)
  }

  authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers['authorization'] as string

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access token required' })
      }

      const token = authHeader.substring(7)

      // 1. Try verifying as backend JWT
      try {
        const isBlocked = await this.authService.isTokenBlocked(token)
        if (isBlocked) {
          return res.status(401).json({ error: 'Token has been revoked. Please log in again.' })
        }

        const decoded = this.authService.verifyToken(token)
        req.user = decoded
        return next()
      } catch (jwtError) {
        // 2. If JWT fails, try verifying as Firebase ID token (Mixed Flow Support)
        try {
          const decodedFB = await firebaseAuth.verifyIdToken(token)
          
          // Check for globalRole if we want to enforce it here too
          if (decodedFB.globalRole !== 'agrovelt') {
             return res.status(403).json({ error: 'Forbidden: Invalid domain claim' })
          }

          if (!decodedFB.email) {
            return res.status(401).json({ error: 'Firebase token missing email' })
          }

          const user = await this.authService['prisma'].user.findUnique({
            where: { email: decodedFB.email }
          })

          if (!user || !user.isActive) {
            return res.status(401).json({ error: 'User account not found or inactive' })
          }

          req.user = {
            userId: user.id,
            email: user.email,
            role: user.role
          }
          return next()
        } catch (fbError) {
          return res.status(401).json({ error: 'Invalid or expired token' })
        }
      }
    } catch (error) {
      return res.status(401).json({ error: 'Authentication failed' })
    }
  }

  authorize = (...roles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }

      next()
    }
  }

  requireShopAccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const shopId = req.params?.shopId || req.body?.shopId || req.query?.shopId

      if (!shopId) {
        return res.status(400).json({ error: 'Shop ID required' })
      }

      // Admin can access all shops
      if (req.user.role === 'ADMIN') {
        return next()
      }

      // Check if user owns the shop or is staff
      const shop = await this.authService['prisma'].shop.findUnique({
        where: { id: shopId as string },
        select: {
          ownerId: true,
          staff: {
            where: { userId: req.user.userId },
            select: { id: true }
          }
        }
      })

      if (!shop) {
        return res.status(404).json({ error: 'Shop not found' })
      }

      if (shop.ownerId !== req.user.userId && shop.staff.length === 0) {
        return res.status(403).json({ error: 'Access denied to this shop' })
      }

      next()
    } catch (error) {
      return res.status(500).json({ error: 'Authorization check failed' })
    }
  }

  logActivity = (action: string, entity: string) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const authService = this.authService
      const originalSend = res.send

      res.send = function(data: any) {
        // Log activity after response
        if (req.user) {
          const entityId = req.params?.id || req.params?.shopId || req.params?.userId || 'unknown'
          authService['logActivity'](
            req.user.userId,
            action,
            entity,
            entityId as string,
            { method: req.method, path: req.path, status: res.statusCode }
          ).catch((err: any) => console.error('Activity logging failed:', err))
        }

        // Call original send
        return originalSend.call(this, data)
      }

      next()
    }
  }
}