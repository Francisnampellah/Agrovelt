import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthMiddleware, AuthService } from '../modules/auth'
import { createExpenseModule } from '../modules/expense'
import { NotificationService } from '../modules/notifications/notification.service'

export function createExpenseRoutes(
  prisma: PrismaClient,
  notificationService?: NotificationService
) {
  const router = Router()
  const authMiddleware = new AuthMiddleware(new AuthService(prisma))
  const { expenseController } = createExpenseModule(prisma, notificationService)

  router.post(
    '/expenses',
    authMiddleware.authenticate,
    expenseController.createValidation,
    expenseController.create
  )

  router.get(
    '/expenses',
    authMiddleware.authenticate,
    expenseController.listValidation,
    expenseController.list
  )

  return router
}
