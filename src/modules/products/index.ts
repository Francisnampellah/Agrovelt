import { PrismaClient } from '@prisma/client'
import { ProductService } from './products.service'
import { ProductController } from './products.controller'
import { BulkProductService } from './bulk-products.service'

export function createProductModule(prisma: PrismaClient) {
  const productService = new ProductService(prisma)
  const bulkProductService = new BulkProductService(prisma)
  const productController = new ProductController(productService, bulkProductService)

  return {
    productService,
    bulkProductService,
    productController
  }
}

export {
  ProductService,
  BulkProductService,
  ProductController
}

export * from './types'
export * from './products.swagger'
