import { Request, Response, NextFunction } from 'express'
import { firebaseAuth } from '../../config/firebase'

export interface FirebaseAuthenticatedRequest extends Request {
  firebaseUser?: {
    uid: string
    email?: string | null
    name?: string | null
  }
}

export class FirebaseAuthMiddleware {
  /**
   * Verify Firebase ID token from Authorization header
   */
  static authenticate = async (
    req: FirebaseAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const token = req.headers.authorization?.substring(7) // Remove "Bearer "

      if (!token) {
        return res.status(401).json({ error: 'No token provided' })
      }

      const decodedToken = await firebaseAuth.verifyIdToken(token)
      req.firebaseUser = {
        uid: decodedToken.uid,
        email: decodedToken.email || null,
        name: decodedToken.name || null,
      }

      next()
    } catch (error: any) {
      res.status(401).json({ error: 'Invalid or expired token' })
    }
  }

  /**
   * Verify user role (requires authentication first)
   */
  static authorize =
    (...roles: string[]) =>
    async (req: FirebaseAuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.firebaseUser) {
          return res.status(401).json({ error: 'Authentication required' })
        }

        // You'll need to fetch the user role from Prisma
        // This is a basic example - adjust based on your needs
        next()
      } catch (error: any) {
        res.status(403).json({ error: 'Authorization failed' })
      }
    }
}
