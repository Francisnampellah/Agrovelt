import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthService, AuthController, AuthMiddleware } from '../modules/auth'

export function createAdminRoutes(prisma: PrismaClient) {
  const router = Router()
  const authService = new AuthService(prisma)
  const authController = new AuthController(authService)
  const authMiddleware = new AuthMiddleware(authService)

  /**
   * @swagger
   * /api/admin/users:
   *   get:
   *     summary: Get all users (Admin only)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   */
  router.get('/users', authMiddleware.authenticate, authMiddleware.authorize('ADMIN'), authController.getUsers)

  /**
   * @swagger
   * /api/admin/users/{userId}/deactivate:
   *   put:
   *     summary: Deactivate user (Admin only)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: string
   */
  router.put('/users/:userId/deactivate', authMiddleware.authenticate, authMiddleware.authorize('ADMIN'), authController.deactivateUser)

  return router
}
