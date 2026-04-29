import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthMiddleware, AuthService } from '../modules/auth'
import { createInventoryModule } from '../modules/inventory'

const router = Router()

export function createInventoryRoutes(prisma: PrismaClient) {
  const authMiddleware = new AuthMiddleware(new AuthService(prisma))
  const { inventoryController } = createInventoryModule(prisma)

/**
 * @swagger
 * /api/inventory/shops/{shopId}:
 *   get:
 *     summary: Get inventory levels for a shop
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Shop inventory levels
 */
router.get('/inventory/shops/:shopId', authMiddleware.authenticate, inventoryController.getByShop)

/**
 * @swagger
 * /api/inventory/update:
 *   post:
 *     summary: Set inventory level (upsert)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shopId, variantId, quantity, costPrice, sellingPrice]
 *             properties:
 *               shopId: { type: string }
 *               variantId: { type: string }
 *               quantity: { type: integer }
 *               costPrice: { type: number }
 *               sellingPrice: { type: number }
 *     responses:
 *       200:
 *         description: Inventory updated
 */
router.post('/inventory/update', authMiddleware.authenticate, inventoryController.updateValidation, inventoryController.update)

/**
 * @swagger
 * /api/inventory/adjust:
 *   post:
 *     summary: Adjust inventory level and record transaction
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shopId, variantId, change, type]
 *             properties:
 *               shopId: { type: string }
 *               variantId: { type: string }
 *               change: { type: integer }
 *               type: { type: string, enum: [PURCHASE, SALE, ADJUSTMENT, RETURN] }
 *               referenceId: { type: string }
 *     responses:
 *       200:
 *         description: Inventory adjusted
 */
router.post('/inventory/adjust', authMiddleware.authenticate, inventoryController.adjustValidation, inventoryController.adjust)

/**
 * @swagger
 * /api/inventory/shops/{shopId}/transactions:
 *   get:
 *     summary: Get inventory transactions for a shop
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Shop inventory transactions
 */
router.get('/inventory/shops/:shopId/transactions', authMiddleware.authenticate, inventoryController.getTransactionsByShop)

  return router
}
