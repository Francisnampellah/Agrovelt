import { PrismaClient } from '@prisma/client'
import { AuthService } from '../auth/auth.service'
import { createNotificationModule } from '../notifications'
import { NotificationService } from '../notifications/notification.service'
import { SaleService } from '../sale/sale.service'
import { ExpenseService } from '../expense/expense.service'
import { PurchaseService } from '../purchase/purchase.service'
import { OrganizationService } from './organization.service'
import { OrganizationController } from './organization.controller'

export interface OrganizationModuleDeps {
  saleService: SaleService
  expenseService: ExpenseService
  purchaseService: PurchaseService
  notificationService: NotificationService
}

export function createOrganizationModule(
  prisma: PrismaClient,
  deps?: OrganizationModuleDeps
) {
  const authService = new AuthService(prisma)
  const organizationService = new OrganizationService(prisma)

  const services = deps ?? createNotificationModule(prisma)

  const organizationController = new OrganizationController(
    organizationService,
    authService,
    prisma,
    services.saleService,
    services.expenseService,
    services.purchaseService,
    services.notificationService
  )

  return {
    organizationService,
    organizationController
  }
}

export { OrganizationService, OrganizationController }
export * from './types'
export * from './organization.swagger'
