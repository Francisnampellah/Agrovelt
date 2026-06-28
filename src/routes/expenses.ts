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

  /**
   * @swagger
   * /api/expenses:
   *   post:
   *     summary: Record an expense
   *     tags: [Expenses]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [shopId, title, amount, date]
   *             properties:
   *               shopId:
   *                 type: string
   *                 format: uuid
   *               title:
   *                 type: string
   *               amount:
   *                 type: number
   *               category:
   *                 type: string
   *               date:
   *                 type: string
   *                 format: date-time
   *     responses:
   *       201:
   *         description: Expense created
   */
  router.post(
    '/expenses',
    authMiddleware.authenticate,
    expenseController.createValidation,
    expenseController.create
  )

  /**
   * @swagger
   * /api/expenses:
   *   get:
   *     summary: List expenses for a shop
   *     tags: [Expenses]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: shopId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: List of expenses
   */
  router.get(
    '/expenses',
    authMiddleware.authenticate,
    expenseController.listValidation,
    expenseController.list
  )

  return router
}
