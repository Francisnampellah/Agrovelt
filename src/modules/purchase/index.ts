import { PrismaClient } from '@prisma/client'
import { InventoryService } from '../inventory/inventory.service'
import { PricingService } from '../pricing/pricing.service'
import { CashFlowService } from '../cashflow/cashflow.service'
import { createNotificationModule } from '../notifications'
import { NotificationService } from '../notifications/notification.service'
import { PurchaseService } from './purchase.service'
import { PurchaseController } from './purchase.controller'

export function createPurchaseModule(prisma: PrismaClient, notificationService?: NotificationService) {
  const inventoryService = new InventoryService(prisma)
  const pricingService = new PricingService(prisma)
  const cashFlowService = new CashFlowService(prisma)
  const purchaseService = new PurchaseService(prisma, inventoryService, pricingService, cashFlowService)

  const notifications =
    notificationService ?? createNotificationModule(prisma).notificationService

  const purchaseController = new PurchaseController(purchaseService, notifications)

  return { purchaseService, purchaseController }
}

export { PurchaseService, PurchaseController }
