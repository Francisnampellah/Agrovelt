import { ShopService } from './shop.service'
import { ShopController } from './shop.controller'
import { PrismaClient } from '@prisma/client'

export function createShopModule(prisma: PrismaClient) {
  const shopService = new ShopService(prisma)
  const shopController = new ShopController(shopService)

  return {
    shopService,
    shopController
  }
}

export {
  ShopService,
  ShopController
}

export * from './types'
