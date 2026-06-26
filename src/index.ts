import 'dotenv/config'
import express from 'express'
import path from 'path'
import cors from 'cors'
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
const PORT = process.env.PORT || 4000
const allowedOrigins = [
  'http://localhost:5174',
  'http://localhost:5173',
  'https://app.afyamnyamadigital.co.tz',
  'https://afyamnyamadigital.co.tz'
]
// ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINiNHyBbBzM3bXJJWDMNR3idYuLsgxh5yt7vURuNLIA9 shokokimera@gmail.com

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}))
app.options(/.*/, cors({
  origin: allowedOrigins,
  credentials: true
})) // Enable pre-flight for all routes
app.use(express.json())

// Normalize API paths to lowercase so /api/Organizations matches /api/organizations
app.use((req, _res, next) => {
  const queryIndex = req.url.indexOf('?')
  const pathname = queryIndex === -1 ? req.url : req.url.slice(0, queryIndex)
  const query = queryIndex === -1 ? '' : req.url.slice(queryIndex)
  const normalized = pathname.toLowerCase()
  if (normalized !== pathname) {
    req.url = normalized + query
  }
  next()
})

// Serve static files for product images
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

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
    '/api-docs',
    '/uploads' // Allow access to uploaded images without authentication
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
  console.log(`Agrovet POS API running on port ${PORT}`)
  console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`)
})

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
