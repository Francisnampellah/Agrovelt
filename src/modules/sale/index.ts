import { PrismaClient } from '@prisma/client'
import { InventoryService } from '../inventory/inventory.service'
import { CashFlowService } from '../cashflow/cashflow.service'
import { PricingService } from '../pricing/pricing.service'
import { SaleService } from './sale.service'
import { SaleController } from './sale.controller'

export function createSaleModule(prisma: PrismaClient) {
  const inventoryService = new InventoryService(prisma)
  const cashFlowService = new CashFlowService(prisma)
  const pricingService = new PricingService(prisma)
  const saleService = new SaleService(prisma, inventoryService, cashFlowService, pricingService)
  const saleController = new SaleController(saleService)

  return {
    saleService,
    saleController
  }
}

export { SaleService, SaleController }
export * from './types'
export * from './sale.swagger'
