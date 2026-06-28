import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthMiddleware, AuthService } from '../modules/auth'
import { createPurchaseModule } from '../modules/purchase'
import { NotificationService } from '../modules/notifications/notification.service'

export function createPurchaseRoutes(
  prisma: PrismaClient,
  notificationService?: NotificationService
) {
  const router = Router()
  const authMiddleware = new AuthMiddleware(new AuthService(prisma))
  const { purchaseController } = createPurchaseModule(prisma, notificationService)

  /**
   * @swagger
   * /api/purchases:
   *   post:
   *     summary: Record a stock purchase
   *     tags: [Purchases]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [shopId, items]
   *             properties:
   *               shopId:
   *                 type: string
   *                 format: uuid
   *               supplierId:
   *                 type: string
   *                 format: uuid
   *               items:
   *                 type: array
   *                 items:
   *                   type: object
   *                   required: [variantId, quantity, costPrice]
   *                   properties:
   *                     variantId:
   *                       type: string
   *                       format: uuid
   *                     quantity:
   *                       type: integer
   *                     costPrice:
   *                       type: number
   *                     batchNumber:
   *                       type: string
   *                     expiryDate:
   *                       type: string
   *                       format: date-time
   *     responses:
   *       201:
   *         description: Purchase created
   */
  router.post(
    '/purchases',
    authMiddleware.authenticate,
    purchaseController.createValidation,
    purchaseController.create
  )

  /**
   * @swagger
   * /api/purchases:
   *   get:
   *     summary: List purchases for a shop
   *     tags: [Purchases]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: shopId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: List of purchases
   */
  router.get(
    '/purchases',
    authMiddleware.authenticate,
    purchaseController.listValidation,
    purchaseController.list
  )

  return router
}
