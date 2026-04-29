import express from 'express'
import swaggerUi from 'swagger-ui-express'
import swaggerJsdoc from 'swagger-jsdoc'
import { prisma } from './config/database'
import { getSwaggerConfig } from './config/swagger'
import { AuthService, AuthMiddleware } from './modules/auth'
import { createHealthRoutes } from './routes/health'
import { createAuthRoutes } from './routes/auth'
import { createAdminRoutes } from './routes/admin'
import { createUserRoutes } from './routes/users'
import { createShopRoutes } from './routes/shops'
import { createProductRoutes } from './routes/products'
import { createInventoryRoutes } from './routes/inventory'
import { createOrganizationRoutes } from './routes/organizations'
import { createFirebaseRoutes } from './routes/firebase'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(express.json())

// Swagger
const swaggerSpec = swaggerJsdoc(getSwaggerConfig(PORT))
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// Global auth checker
const authService = new AuthService(prisma)
const authMiddleware = new AuthMiddleware(authService)
app.use((req, res, next) => {
  // Hardcoded check to bypass auth for public routes because req.path might be prefixed
  const publicPaths = [
    '/api/auth/register',
    '/api/auth/login',
    '/api/auth/exchange',
    '/api/auth/refresh-token',
    '/health',
    '/api-docs'
  ]
  
  if (publicPaths.some(p => req.path.startsWith(p))) {
    return next()
  }
  
  authMiddleware.globalAuthChecker(req, res, next)
})

// Routes
app.use('/', createHealthRoutes(prisma))
app.use('/api/auth', createAuthRoutes(prisma))
app.use('/api/admin', createAdminRoutes(prisma))
app.use('/api/firebase', createFirebaseRoutes(prisma))
app.use('/api', createUserRoutes(prisma))
app.use('/api', createShopRoutes(prisma))
app.use('/api', createProductRoutes(prisma))
app.use('/api', createInventoryRoutes(prisma))
app.use('/api', createOrganizationRoutes(prisma))

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
