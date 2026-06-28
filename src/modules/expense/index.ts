import { PrismaClient } from '@prisma/client'
import { CashFlowService } from '../cashflow/cashflow.service'
import { createNotificationModule } from '../notifications'
import { NotificationService } from '../notifications/notification.service'
import { ExpenseService } from './expense.service'
import { ExpenseController } from './expense.controller'

export function createExpenseModule(prisma: PrismaClient, notificationService?: NotificationService) {
  const cashFlowService = new CashFlowService(prisma)
  const expenseService = new ExpenseService(prisma, cashFlowService)

  const notifications =
    notificationService ?? createNotificationModule(prisma).notificationService

  const expenseController = new ExpenseController(expenseService, notifications)

  return { expenseService, expenseController }
}

export { ExpenseService, ExpenseController }
