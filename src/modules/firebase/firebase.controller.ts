import { Response } from 'express'
import { FirebaseAuthService } from './firebase.service'
import { FirebaseAuthenticatedRequest } from './firebase.middleware'

export class FirebaseAuthController {
  constructor(private firebaseAuthService: FirebaseAuthService) {}

  /**
   * Verify Firebase token and sync/create user
   */
  verifyToken = async (req: any, res: Response) => {
    try {
      const { token } = req.body

      if (!token) {
        return res.status(400).json({ error: 'Token required' })
      }

      const user = await this.firebaseAuthService.verifyAndSyncUser(token)

      res.json({
        message: 'Token verified and user synced',
        user,
      })
    } catch (error: any) {
      res.status(401).json({ error: error.message })
    }
  }

  /**
   * Get user profile
   */
  getProfile = async (req: FirebaseAuthenticatedRequest, res: Response) => {
    try {
      if (!req.firebaseUser) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const profile = await this.firebaseAuthService.getUserProfile(req.firebaseUser.uid)
      res.json(profile)
    } catch (error: any) {
      res.status(404).json({ error: error.message })
    }
  }

  /**
   * Update user profile
   */
  updateProfile = async (req: FirebaseAuthenticatedRequest, res: Response) => {
    try {
      if (!req.firebaseUser) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const { name, email } = req.body
      const user = await this.firebaseAuthService.updateUserProfile(
        req.firebaseUser.uid,
        { name, email }
      )

      res.json({
        message: 'Profile updated successfully',
        user,
      })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  /**
   * Get all users (admin only)
   */
  getAllUsers = async (req: FirebaseAuthenticatedRequest, res: Response) => {
    try {
      const users = await this.firebaseAuthService.getAllUsers()
      res.json(users)
    } catch (error: any) {
      res.status(403).json({ error: error.message })
    }
  }

  /**
   * Deactivate user
   */
  deactivateUser = async (req: FirebaseAuthenticatedRequest, res: Response) => {
    try {
      const uid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid

      if (!uid) {
        return res.status(400).json({ error: 'User UID required' })
      }

      const user = await this.firebaseAuthService.deactivateUser(uid)

      res.json({
        message: 'User deactivated successfully',
        user,
      })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }
}
