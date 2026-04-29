import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthMiddleware, AuthService } from '../modules/auth'
import { createProductModule } from '../modules/products'

const router = Router()

// Function to create router with dependencies
export function createProductRoutes(prisma: PrismaClient) {
  const authMiddleware = new AuthMiddleware(new AuthService(prisma))
  const { productController } = createProductModule(prisma)

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of categories
 */
router.get('/categories', authMiddleware.authenticate, productController.getAllCategories)

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Create a new category
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       201:
 *         description: Category created
 */
router.post('/categories', authMiddleware.authenticate, productController.categoryValidation, productController.createCategory)

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of products
 */
router.get('/products', authMiddleware.authenticate, productController.getAllProducts)

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product details
 */
router.get('/products/:id', authMiddleware.authenticate, productController.getProductById)

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create a new product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               categoryId: { type: string }
 *     responses:
 *       201:
 *         description: Product created
 */
router.post('/products', authMiddleware.authenticate, productController.productValidation, productController.createProduct)

/**
 * @swagger
 * /api/variants:
 *   post:
 *     summary: Create a new product variant
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, name, sku]
 *             properties:
 *               productId: { type: string }
 *               name: { type: string }
 *               sku: { type: string }
 *     responses:
 *       201:
 *         description: Variant created
 */
router.post('/variants', authMiddleware.authenticate, productController.variantValidation, productController.createVariant)

  return router
}