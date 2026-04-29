import { PrismaClient } from '@prisma/client'
import { InventoryService } from './inventory.service'
import { InventoryController } from './inventory.controller'

export function createInventoryModule(prisma: PrismaClient) {
  const inventoryService = new InventoryService(prisma)
  const inventoryController = new InventoryController(inventoryService)

  return {
    inventoryService,
    inventoryController
  }
}

export {
  InventoryService,
  InventoryController
}

export * from './types'
