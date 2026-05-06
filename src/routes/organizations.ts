import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthMiddleware, AuthService } from '../modules/auth'
import { createOrganizationModule } from '../modules/organizations'

const router = Router()

export function createOrganizationRoutes(prisma: PrismaClient) {
  const authMiddleware = new AuthMiddleware(new AuthService(prisma))
  const { organizationController } = createOrganizationModule(prisma)

  router.post('/organizations', authMiddleware.authenticate, authMiddleware.authorize('SUPER_ADMIN'), organizationController.createValidation, organizationController.create)
  router.get('/organizations', authMiddleware.authenticate, authMiddleware.authorize('SUPER_ADMIN'), organizationController.getAll)
  router.get('/organizations/:id', authMiddleware.authenticate, authMiddleware.authorize('SUPER_ADMIN'), organizationController.getById)
  router.put('/organizations/:id', authMiddleware.authenticate, authMiddleware.authorize('SUPER_ADMIN'), organizationController.updateValidation, organizationController.update)

  return router
}
