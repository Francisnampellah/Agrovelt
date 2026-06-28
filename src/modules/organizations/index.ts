import { PrismaClient } from '@prisma/client'
import { AuthService } from '../auth/auth.service'
import { createNotificationModule } from '../notifications'
import { createInventoryModule } from '../inventory'
import { createShopModule } from '../shops'
import { NotificationService } from '../notifications/notification.service'
import { ExpenseService } from '../expense/expense.service'
import { InventoryService } from '../inventory/inventory.service'
import { PurchaseService } from '../purchase/purchase.service'
import { SaleService } from '../sale/sale.service'
import { ShopService } from '../shops/shop.service'
import { OrganizationService } from './organization.service'
import { OrganizationController } from './organization.controller'

export interface OrganizationModuleDeps {
  saleService: SaleService
  expenseService: ExpenseService
  purchaseService: PurchaseService
  notificationService: NotificationService
  inventoryService: InventoryService
  shopService: ShopService
}

export function createOrganizationModule(
  prisma: PrismaClient,
  deps?: OrganizationModuleDeps
) {
  const authService = new AuthService(prisma)
  const organizationService = new OrganizationService(prisma)

  const services = deps ?? {
    ...createNotificationModule(prisma),
    ...createInventoryModule(prisma),
    ...createShopModule(prisma)
  }

  const organizationController = new OrganizationController(
    organizationService,
    authService,
    prisma,
    services.saleService,
    services.expenseService,
    services.purchaseService,
    services.notificationService,
    services.inventoryService,
    services.shopService
  )

  return {
    organizationService,
    organizationController
  }
}

export { OrganizationService, OrganizationController }
export * from './types'
export * from './organization.swagger'
