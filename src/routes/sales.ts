import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthMiddleware, AuthService } from '../modules/auth'
import { createSaleModule } from '../modules/sale'
import { NotificationService } from '../modules/notifications/notification.service'

export function createSaleRoutes(
  prisma: PrismaClient,
  notificationService?: NotificationService
) {
  const router = Router()
  const authMiddleware = new AuthMiddleware(new AuthService(prisma))
  const { saleController } = createSaleModule(prisma, notificationService)

  /**
   * @swagger
   * /api/sales:
   *   post:
   *     summary: Create a sale
   *     tags: [Sales]
   *     security:
   *       - bearerAuth: []
   *     description: |
   *       Record a sale using the global product catalog. Any shop can sell any product variant in stock.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [shopId, paymentMethod, items]
   *             properties:
   *               shopId:
   *                 type: string
   *                 format: uuid
   *               paymentMethod:
   *                 type: string
   *                 enum: [CASH, CARD, MOBILE]
   *               discount:
   *                 type: number
   *               tax:
   *                 type: number
   *               items:
   *                 type: array
   *                 items:
   *                   type: object
   *                   required: [variantId, quantity]
   *                   properties:
   *                     variantId:
   *                       type: string
   *                       format: uuid
   *                     quantity:
   *                       type: integer
   *                     price:
   *                       type: number
   *                     batchNumber:
   *                       type: string
   *     responses:
   *       201:
   *         description: Sale created
   *       400:
   *         description: Invalid input or insufficient stock
   */
  router.post(
    '/sales',
    authMiddleware.authenticate,
    saleController.createValidation,
    saleController.create
  )

  /**
   * @swagger
   * /api/sales:
   *   get:
   *     summary: List sales for a shop
   *     tags: [Sales]
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
   *         description: List of sales
   */
  router.get(
    '/sales',
    authMiddleware.authenticate,
    saleController.listValidation,
    saleController.list
  )

  /**
   * @swagger
   * /api/sales/{saleId}:
   *   get:
   *     summary: Get sale by ID
   *     tags: [Sales]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: saleId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Sale details
   *       404:
   *         description: Sale not found
   */
  router.get(
    '/sales/:saleId',
    authMiddleware.authenticate,
    saleController.getById
  )

  /**
   * @swagger
   * /api/sales/{saleId}/refund:
   *   post:
   *     summary: Refund a sale
   *     tags: [Sales]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: saleId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Sale refunded
   */
  router.post(
    '/sales/:saleId/refund',
    authMiddleware.authenticate,
    saleController.refundValidation,
    saleController.refund
  )

  return router
}
