import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthMiddleware, AuthService } from '../modules/auth'
import { createPurchaseModule } from '../modules/purchase'
import { NotificationService } from '../modules/notifications/notification.service'

export function createPurchaseRoutes(
  prisma: PrismaClient,
  notificationService?: NotificationService
) {
  const router = Router()
  const authMiddleware = new AuthMiddleware(new AuthService(prisma))
  const { purchaseController } = createPurchaseModule(prisma, notificationService)

  router.post(
    '/purchases',
    authMiddleware.authenticate,
    purchaseController.createValidation,
    purchaseController.create
  )

  router.get(
    '/purchases',
    authMiddleware.authenticate,
    purchaseController.listValidation,
    purchaseController.list
  )

  return router
}
