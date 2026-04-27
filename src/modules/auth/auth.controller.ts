import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { AuthService } from './auth.service'
import { AuthenticatedRequest, LoginRequest, RegisterRequest, ExchangeRequest } from './types'

export class AuthController {
  constructor(private authService: AuthService) {}

  // Validation rules
  registerValidation = [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
    body('role').optional().isIn(['ADMIN', 'OWNER', 'STAFF']).withMessage('Invalid role')
  ]

  loginValidation = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required')
  ]

  updateProfileValidation = [
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email required')
  ]

  changePasswordValidation = [
    body('oldPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
  ]

  refreshTokenValidation = [
    body('refreshToken').notEmpty().withMessage('Refresh token required'),
    body('deviceId').optional().isString()
  ]

  exchangeValidation = [
    body('firebaseToken').notEmpty().withMessage('Firebase token required'),
    body('clientType').isIn(['web', 'mobile']).withMessage('Invalid client type'),
    body('deviceId').optional().isString()
  ]

  logoutValidation = [
    body('refreshToken').optional().isString()
  ]

  register = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const data: RegisterRequest = req.body
      const result = await this.authService.register(data)

      res.status(201).json({
        message: 'User registered successfully',
        ...result
      })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  login = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const data: LoginRequest = req.body
      const result = await this.authService.login(data)

      res.json({
        message: 'Login successful',
        ...result
      })
    } catch (error: any) {
      res.status(401).json({ error: error.message })
    }
  }

  exchange = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const data: ExchangeRequest = req.body
      const result = await this.authService.exchangeFirebaseToken(data)

      res.json({
        message: 'Token exchange successful',
        ...result
      })
    } catch (error: any) {
      res.status(401).json({ error: error.message })
    }
  }

  getProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const profile = await this.authService.getProfile(req.user.userId)
      res.json(profile)
    } catch (error: any) {
      res.status(404).json({ error: error.message })
    }
  }

  updateProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const data = req.body as { name?: string; email?: string }
      const user = await this.authService.updateProfile(req.user.userId, data)

      res.json({
        message: 'Profile updated successfully',
        user
      })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  changePassword = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const { oldPassword, newPassword } = req.body as { oldPassword: string; newPassword: string }
      await this.authService.changePassword(req.user.userId, oldPassword, newPassword)

      res.json({ message: 'Password changed successfully' })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  getUsers = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const users = await this.authService.getUsers(req.user.userId)
      res.json(users)
    } catch (error: any) {
      res.status(403).json({ error: error.message })
    }
  }

  deactivateUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const { userId } = req.params as { userId: string }
      const user = await this.authService.deactivateUser(userId, req.user.userId)

      res.json({
        message: 'User deactivated successfully',
        user
      })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  refreshToken = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { refreshToken, deviceId } = req.body
      const result = await this.authService.refreshTokens(refreshToken, deviceId)

      res.json({
        message: 'Token refreshed successfully',
        ...result
      })
    } catch (error: any) {
      res.status(401).json({ error: error.message })
    }
  }

  logout = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const authHeader = req.headers['authorization'] as string
      const token = authHeader.substring(7)
      
      const { refreshToken } = req.body

      await this.authService.logout(req.user.userId, token, refreshToken)

      res.json({ message: 'Logged out successfully' })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }
}