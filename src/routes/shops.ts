import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthMiddleware } from '../modules/auth'

const router = Router()

// Function to create router with dependencies
export function createShopRoutes(prisma: PrismaClient) {
  const authMiddleware = new AuthMiddleware(new (require('../modules/auth').AuthService)(prisma))

/**
 * @swagger
 * /api/shops:
 *   get:
 *     summary: Get all shops
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of shops
 */
router.get('/shops', authMiddleware.authenticate, async (req, res) => {
  try {
    const shops = await prisma.shop.findMany({
      include: { owner: { select: { name: true, email: true } } }
    })
    res.json(shops)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch shops' })
  }
})

/**
 * @swagger
 * /api/shops:
 *   post:
 *     summary: Create a new shop
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
 *               location:
 *                 type: string
 *     responses:
 *       201:
 *         description: Shop created
 */
router.post('/shops', authMiddleware.authenticate, async (req, res) => {
  try {
    const { name, location } = req.body
    const shop = await prisma.shop.create({
      data: { name, location, ownerId: (req as any).user.userId },
      include: { owner: { select: { name: true, email: true } } }
    })
    res.status(201).json(shop)
  } catch (error) {
    res.status(500).json({ error: 'Failed to create shop' })
  }
})

  return router
}