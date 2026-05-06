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
   *     description: |
   *       Register a new user account.
   *       - **SUPER_ADMIN**: No organizationId required
   *       - **Other roles**: organizationId is required
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
   *                 minLength: 2
   *                 maxLength: 100
   *                 example: John Doe
   *               email:
   *                 type: string
   *                 format: email
   *                 example: john@example.com
   *               password:
   *                 type: string
   *                 minLength: 8
   *                 description: Must contain uppercase, lowercase, number, and special character
   *                 example: SecurePass123!
   *               role:
   *                 type: string
   *                 enum: [SUPER_ADMIN, ADMIN, OWNER, STAFF]
   *                 default: STAFF
   *                 example: ADMIN
   *               organizationId:
   *                 type: string
   *                 format: uuid
   *                 description: Required unless role is SUPER_ADMIN
   *                 example: 123e4567-e89b-12d3-a456-426614174000
   *     responses:
   *       201:
   *         description: User registered successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResponse'
   *       400:
   *         description: Invalid input or user already exists
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/register', authLimiter, authController.registerValidation, authController.register)

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: Login with email and password
   *     tags: [Auth]
   *     description: Authenticate user with email and password to obtain JWT tokens
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
   *                 format: email
   *                 example: john@example.com
   *               password:
   *                 type: string
   *                 example: SecurePass123!
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResponse'
   *       401:
   *         description: Invalid credentials
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/login', authLimiter, authController.loginValidation, authController.login)
  
  /**
   * @swagger
   * /api/auth/exchange:
   *   post:
   *     summary: Exchange Firebase token for backend JWT tokens
   *     tags: [Auth]
   *     description: Exchange a Firebase ID token for backend JWT access and refresh tokens
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
   *                 description: Valid Firebase ID token with 'agrovelt' globalRole claim
   *               clientType:
   *                 type: string
   *                 enum: [web, mobile]
   *                 example: web
   *               deviceId:
   *                 type: string
   *                 nullable: true
   *                 description: Device identifier for mobile clients (optional)
   *     responses:
   *       200:
   *         description: Token exchange successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 accessToken: { type: string }
   *                 refreshToken: { type: string }
   *                 expiresIn: { type: number, description: 'Seconds until token expires' }
   *                 user: { $ref: '#/components/schemas/User' }
   *       401:
   *         description: Invalid or expired Firebase token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/exchange', authLimiter, authController.exchangeValidation, authController.exchange)

  /**
   * @swagger
   * /api/auth/refresh-token:
   *   post:
   *     summary: Refresh expired access token
   *     tags: [Auth]
   *     description: Use refresh token to obtain a new access token
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
   *                 description: Valid refresh token obtained from login
   *               deviceId:
   *                 type: string
   *                 nullable: true
   *                 description: Optional device identifier
   *     responses:
   *       200:
   *         description: New token issued
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 accessToken: { type: string }
   *                 refreshToken: { type: string }
   *                 expiresIn: { type: number, description: 'Seconds (900 = 15 minutes)' }
   *       401:
   *         description: Invalid or revoked refresh token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
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
