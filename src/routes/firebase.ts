import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { FirebaseAuthService, FirebaseAuthController, FirebaseAuthMiddleware } from '../modules/firebase'

export function createFirebaseRoutes(prisma: PrismaClient) {
  const router = Router()
  const firebaseAuthService = new FirebaseAuthService(prisma)
  const firebaseAuthController = new FirebaseAuthController(firebaseAuthService)

  /**
   * @swagger
   * /api/firebase/verify:
   *   post:
   *     summary: Verify Firebase token and sync user
   *     tags: [Firebase Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [token]
   *             properties:
   *               token:
   *                 type: string
   *                 description: Firebase ID token
   *     responses:
   *       200:
   *         description: Token verified and user synced
   *       401:
   *         description: Invalid token
   */
  router.post('/verify', firebaseAuthController.verifyToken)

  /**
   * @swagger
   * /api/firebase/profile:
   *   get:
   *     summary: Get user profile
   *     tags: [Firebase Auth]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User profile
   *       401:
   *         description: Unauthorized
   */
  router.get('/profile', FirebaseAuthMiddleware.authenticate, firebaseAuthController.getProfile)

  /**
   * @swagger
   * /api/firebase/profile:
   *   put:
   *     summary: Update user profile
   *     tags: [Firebase Auth]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               email:
   *                 type: string
   *     responses:
   *       200:
   *         description: Profile updated
   *       401:
   *         description: Unauthorized
   */
  router.put('/profile', FirebaseAuthMiddleware.authenticate, firebaseAuthController.updateProfile)

  return router
}
