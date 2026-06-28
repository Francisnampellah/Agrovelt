import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthMiddleware, AuthService } from '../modules/auth'
import { createNotificationModule } from '../modules/notifications'

export function createNotificationRoutes(prisma: PrismaClient) {
  const router = Router()
  const authMiddleware = new AuthMiddleware(new AuthService(prisma))
  const { notificationController } = createNotificationModule(prisma)

  router.get(
    '/notifications/unread-count',
    authMiddleware.authenticate,
    notificationController.unreadCountValidation,
    notificationController.unreadCount
  )

  router.patch(
    '/notifications/read-all',
    authMiddleware.authenticate,
    notificationController.markAllReadValidation,
    notificationController.markAllAsRead
  )

  router.get(
    '/notifications',
    authMiddleware.authenticate,
    notificationController.listValidation,
    notificationController.list
  )

  router.get(
    '/notifications/:notificationId',
    authMiddleware.authenticate,
    notificationController.idParamValidation,
    notificationController.getById
  )

  router.patch(
    '/notifications/:notificationId/read',
    authMiddleware.authenticate,
    notificationController.idParamValidation,
    notificationController.markAsRead
  )

  router.delete(
    '/notifications/:notificationId',
    authMiddleware.authenticate,
    notificationController.idParamValidation,
    notificationController.remove
  )

  return router
}
