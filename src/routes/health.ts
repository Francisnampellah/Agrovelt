import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()

// Function to create router with dependencies
export function createHealthRoutes(prisma: PrismaClient) {

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     description: Check if the API and database are operational
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 message:
 *                   type: string
 *                   example: Database connected
 *       500:
 *         description: Database connection failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ERROR
 *                 message:
 *                   type: string
 */
router.get('/health', async (req, res) => {
  try {
    const prisma = new PrismaClient()
    await prisma.$queryRaw`SELECT 1`
    await prisma.$disconnect()
    res.json({ status: 'OK', message: 'Database connected' })
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: 'Database connection failed' })
  }
})

  return router
}