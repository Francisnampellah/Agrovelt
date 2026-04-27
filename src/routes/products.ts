import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthMiddleware } from '../modules/auth'

const router = Router()

// Function to create router with dependencies
export function createProductRoutes(prisma: PrismaClient) {
  const authMiddleware = new AuthMiddleware(new (require('../modules/auth').AuthService)(prisma))

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of products
 */
router.get('/products', authMiddleware.authenticate, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { category: true, variants: true }
    })
    res.json(products)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' })
  }
})

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create a new product
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
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               categoryId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Product created
 */
router.post('/products', authMiddleware.authenticate, async (req, res) => {
  try {
    const { name, description, categoryId } = req.body
    const product = await prisma.product.create({
      data: { name, description, categoryId },
      include: { category: true }
    })
    res.status(201).json(product)
  } catch (error) {
    res.status(500).json({ error: 'Failed to create product' })
  }
})

  return router
}