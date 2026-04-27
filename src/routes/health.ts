import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()

// Function to create router with dependencies
export function createHealthRoutes(prisma: PrismaClient) {

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