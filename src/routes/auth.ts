import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthService, AuthController, AuthMiddleware } from '../modules/auth'
import { authLimiter } from '../config/middleware'

export function createAuthRoutes(prisma: PrismaClient) {
  const router = Router()
  const authService = new AuthService(prisma)
  const authController = new AuthController(authService)
  const authMiddleware = new AuthMiddleware(authService)

  /**
   * @swagger
   * /api/auth/register:
   *   post:
   *     summary: Register a new user
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, email, password]
   *             properties:
   *               name:
   *                 type: string
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   *               role:
   *                 type: string
   *                 enum: [ADMIN, OWNER, STAFF]
   */
  router.post('/register', authLimiter, authController.registerValidation, authController.register)

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: Login user
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   */
  router.post('/login', authLimiter, authController.loginValidation, authController.login)
  
  /**
   * @swagger
   * /api/auth/exchange:
   *   post:
   *     summary: Exchange Firebase token for backend tokens
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [firebaseToken, clientType]
   *             properties:
   *               firebaseToken:
   *                 type: string
   *               clientType:
   *                 type: string
   *                 enum: [web, mobile]
   *               deviceId:
   *                 type: string
   */
  router.post('/exchange', authLimiter, authController.exchangeValidation, authController.exchange)

  /**
   * @swagger
   * /api/auth/refresh-token:
   *   post:
   *     summary: Refresh access token
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [refreshToken]
   *             properties:
   *               refreshToken:
   *                 type: string
   */
  router.post('/refresh-token', authController.refreshTokenValidation, authController.refreshToken)

  /**
   * @swagger
   * /api/auth/profile:
   *   get:
   *     summary: Get user profile
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   */
  router.get('/profile', authMiddleware.authenticate, authController.getProfile)

  /**
   * @swagger
   * /api/auth/profile:
   *   put:
   *     summary: Update user profile
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   */
  router.put('/profile', authMiddleware.authenticate, authController.updateProfileValidation, authController.updateProfile)

  /**
   * @swagger
   * /api/auth/change-password:
   *   put:
   *     summary: Change password
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   */
  router.put('/change-password', authMiddleware.authenticate, authController.changePasswordValidation, authController.changePassword)

  /**
   * @swagger
   * /api/auth/logout:
   *   post:
   *     summary: Logout user
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   */
  router.post('/logout', authMiddleware.authenticate, authController.logoutValidation, authController.logout)

  return router
}
