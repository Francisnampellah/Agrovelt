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
 *     description: |
 *       Retrieve all shops. Organization users see only their organization's shops.
 *       SUPER_ADMIN users see all shops across all organizations.
 *     responses:
 *       200:
 *         description: List of shops
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Shop'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *         schema: { type: string, format: uuid }
 *         description: Shop UUID
 *     responses:
 *       200:
 *         description: Shop details including owner, branches, and staff
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Shop'
 *       404:
 *         description: Shop not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/shops/:id', authMiddleware.authenticate, shopController.getById)

/**
 * @swagger
 * /api/shops:
 *   post:
 *     summary: Create a new shop (MAIN or BRANCH)
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Create a new main shop or branch shop.
 *       - **MAIN shop**: parentId is null
 *       - **BRANCH shop**: parentId must point to a valid MAIN shop in same organization
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, ownerId, organizationId]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: Downtown Shop
 *               location:
 *                 type: string
 *                 nullable: true
 *                 example: 123 Main Street, City
 *               ownerId:
 *                 type: string
 *                 format: uuid
 *                 description: User ID of shop owner
 *               organizationId:
 *                 type: string
 *                 format: uuid
 *                 description: Organization UUID the shop belongs to
 *               parentId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 description: Parent shop ID if this is a BRANCH shop
 *     responses:
 *       201:
 *         description: Shop created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Shop'
 *       400:
 *         description: Invalid input, owner not found, or parent shop not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *         schema: { type: string, format: uuid }
 *         description: Shop UUID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 example: Downtown Shop Updated
 *               location:
 *                 type: string
 *                 nullable: true
 *                 example: 456 Oak Avenue, City
 *     responses:
 *       200:
 *         description: Shop updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Shop'
 *       404:
 *         description: Shop not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *         schema: { type: string, format: uuid }
 *         description: Shop UUID
 *     description: Delete a shop. Only shops with no inventory, sales, or purchases can be deleted.
 *     responses:
 *       200:
 *         description: Shop deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Shop not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/shops/:id', authMiddleware.authenticate, shopController.delete)

/**
 * @swagger
 * /api/owners/{ownerId}/shops:
 *   get:
 *     summary: Get all shops owned by a user
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ownerId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Owner User UUID
 *     responses:
 *       200:
 *         description: List of shops owned by the user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Shop'
 */
router.get('/owners/:ownerId/shops', authMiddleware.authenticate, shopController.getByOwner)

  return router
}