import { PrismaClient } from '@prisma/client'
import { InventoryService } from '../inventory/inventory.service'
import { CashFlowService } from '../cashflow/cashflow.service'
import { PricingService } from '../pricing/pricing.service'
import { SaleService } from '../sale/sale.service'
import { ExpenseService } from '../expense/expense.service'
import { PurchaseService } from '../purchase/purchase.service'
import { ReceiptService } from '../receipt/receipt.service'
import { NotificationService } from './notification.service'
import { NotificationController } from './notification.controller'

export function createNotificationModule(prisma: PrismaClient) {
  const inventoryService = new InventoryService(prisma)
  const cashFlowService = new CashFlowService(prisma)
  const pricingService = new PricingService(prisma)
  const receiptService = new ReceiptService(prisma)
  const saleService = new SaleService(
    prisma,
    inventoryService,
    cashFlowService,
    pricingService,
    receiptService
  )
  const expenseService = new ExpenseService(prisma, cashFlowService)
  const purchaseService = new PurchaseService(prisma, inventoryService, pricingService, cashFlowService)
  const notificationService = new NotificationService(prisma)
  const notificationController = new NotificationController(notificationService, prisma)

  return {
    saleService,
    expenseService,
    purchaseService,
    notificationService,
    notificationController
  }
}

export { NotificationService, NotificationController }
export * from './types'
