import { PrismaClient } from '@prisma/client'
import { InventoryService } from './inventory.service'
import { InventoryController } from './inventory.controller'
import { BulkInventoryService } from './bulk-inventory.service'

export function createInventoryModule(prisma: PrismaClient) {
  const inventoryService = new InventoryService(prisma)
  const bulkInventoryService = new BulkInventoryService(prisma, inventoryService)
  const inventoryController = new InventoryController(inventoryService, bulkInventoryService)

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
