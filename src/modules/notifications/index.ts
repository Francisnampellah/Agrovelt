import { PrismaClient } from '@prisma/client'
import { InventoryService } from '../inventory/inventory.service'
import { CashFlowService } from '../cashflow/cashflow.service'
import { PricingService } from '../pricing/pricing.service'
import { SaleService } from '../sale/sale.service'
import { ExpenseService } from '../expense/expense.service'
import { PurchaseService } from '../purchase/purchase.service'
import { NotificationService } from './notification.service'

export function createNotificationModule(prisma: PrismaClient) {
  const inventoryService = new InventoryService(prisma)
  const cashFlowService = new CashFlowService(prisma)
  const pricingService = new PricingService(prisma)
  const saleService = new SaleService(prisma, inventoryService, cashFlowService, pricingService)
  const expenseService = new ExpenseService(prisma, cashFlowService)
  const purchaseService = new PurchaseService(prisma, inventoryService, pricingService, cashFlowService)
  const notificationService = new NotificationService(saleService, expenseService, purchaseService)

  return {
    saleService,
    expenseService,
    purchaseService,
    notificationService
  }
}

export { NotificationService }
export * from './types'
