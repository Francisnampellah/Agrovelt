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
 *     summary: Get all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **ADMIN only** - Retrieve all users in the organization.
 *       SUPER_ADMIN can see all users across all organizations.
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/users', authMiddleware.authenticate, authMiddleware.authorize('ADMIN'), authController.getUsers)

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **ADMIN only** - Create a new user in the organization.
 *       For SUPER_ADMIN role, no organizationId is required.
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
 *                 example: John Smith
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.smith@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Must contain uppercase, lowercase, number, and special character
 *               role:
 *                 type: string
 *                 enum: [SUPER_ADMIN, ADMIN, OWNER, STAFF]
 *                 default: STAFF
 *               organizationId:
 *                 type: string
 *                 format: uuid
 *                 description: Required unless role is SUPER_ADMIN
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/users', authMiddleware.authenticate, authMiddleware.authorize('ADMIN'), authController.registerValidation, authController.register)

  return router
}