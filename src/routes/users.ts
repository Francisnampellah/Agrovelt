import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthService, AuthController, AuthMiddleware } from '../modules/auth'

const router = Router()

// Function to create router with dependencies
export function createUserRoutes(prisma: PrismaClient) {
  const authService = new AuthService(prisma)
  const authController = new AuthController(authService)
  const authMiddleware = new AuthMiddleware(authService)

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *       403:
 *         description: Admin access required
 */
router.get('/users', authMiddleware.authenticate, authMiddleware.authorize('ADMIN'), authController.getUsers)

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
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
 *     responses:
 *       201:
 *         description: User created
 *       403:
 *         description: Admin access required
 */
router.post('/users', authMiddleware.authenticate, authMiddleware.authorize('ADMIN'), authController.registerValidation, authController.register)

  return router
}