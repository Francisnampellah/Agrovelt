import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthMiddleware, AuthService } from '../modules/auth'
import { createShopModule } from '../modules/shops'

const router = Router()

// Function to create router with dependencies
export function createShopRoutes(prisma: PrismaClient) {
  const authMiddleware = new AuthMiddleware(new AuthService(prisma))
  const { shopController } = createShopModule(prisma)

/**
 * @swagger
 * /api/shops:
 *   get:
 *     summary: Get all shops
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of shops
 */
router.get('/shops', authMiddleware.authenticate, shopController.getAll)

/**
 * @swagger
 * /api/shops/{id}:
 *   get:
 *     summary: Get shop by ID
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shop details
 *       404:
 *         description: Shop not found
 */
router.get('/shops/:id', authMiddleware.authenticate, shopController.getById)

/**
 * @swagger
 * /api/shops:
 *   post:
 *     summary: Create a new shop
 *     tags: [Shops]
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
 *               - ownerId
 *             properties:
 *               name:
 *                 type: string
 *               location:
 *                 type: string
 *               ownerId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Shop created
 */
router.post('/shops', authMiddleware.authenticate, shopController.createShopValidation, shopController.create)

/**
 * @swagger
 * /api/shops/{id}:
 *   put:
 *     summary: Update a shop
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Shop updated
 */
router.put('/shops/:id', authMiddleware.authenticate, shopController.updateShopValidation, shopController.update)

/**
 * @swagger
 * /api/shops/{id}:
 *   delete:
 *     summary: Delete a shop
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shop deleted
 */
router.delete('/shops/:id', authMiddleware.authenticate, shopController.delete)

/**
 * @swagger
 * /api/owners/{ownerId}/shops:
 *   get:
 *     summary: Get shops by owner ID
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ownerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of owner's shops
 */
router.get('/owners/:ownerId/shops', authMiddleware.authenticate, shopController.getByOwner)

  return router
}