import express from 'express'
import swaggerUi from 'swagger-ui-express'
import swaggerJsdoc from 'swagger-jsdoc'
import { prisma } from './config/database'
import { getSwaggerConfig } from './config/swagger'
import { AuthMiddleware } from './modules/auth'
import { createHealthRoutes } from './routes/health'
import { createAuthRoutes } from './routes/auth'
import { createAdminRoutes } from './routes/admin'
import { createUserRoutes } from './routes/users'
import { createShopRoutes } from './routes/shops'
import { createProductRoutes } from './routes/products'
import { createFirebaseRoutes } from './routes/firebase'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(express.json())

// Swagger
const swaggerSpec = swaggerJsdoc(getSwaggerConfig(PORT))
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// Global auth checker
const authMiddleware = new AuthMiddleware(undefined as any)
app.use(authMiddleware.globalAuthChecker)

// Routes
app.use('/', createHealthRoutes(prisma))
app.use('/api/auth', createAuthRoutes(prisma))
app.use('/api/admin', createAdminRoutes(prisma))
app.use('/api/firebase', createFirebaseRoutes(prisma))
app.use('/api', createUserRoutes(prisma))
app.use('/api', createShopRoutes(prisma))
app.use('/api', createProductRoutes(prisma))

// Start server
app.listen(PORT, () => {
  console.log(`Agrovelt POS API running on port ${PORT}`)
  console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`)
})

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
