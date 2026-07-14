import { PrismaClient } from '@prisma/client'
import { InventoryService } from './inventory.service'
import { InventoryController } from './inventory.controller'
import { BulkInventoryService } from './bulk-inventory.service'
import { PricingService } from '../pricing/pricing.service'

export function createInventoryModule(prisma: PrismaClient) {
  const pricingService = new PricingService(prisma)
  const inventoryService = new InventoryService(prisma, pricingService)
  const bulkInventoryService = new BulkInventoryService(prisma, inventoryService)
  const inventoryController = new InventoryController(inventoryService, bulkInventoryService, prisma)

  return {
    inventoryService,
    bulkInventoryService,
    inventoryController
  }
}

export {
  InventoryService,
  BulkInventoryService,
  InventoryController
}

export * from './types'
