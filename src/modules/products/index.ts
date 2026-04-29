import { PrismaClient } from '@prisma/client'
import { ProductService } from './products.service'
import { ProductController } from './products.controller'

export function createProductModule(prisma: PrismaClient) {
  const productService = new ProductService(prisma)
  const productController = new ProductController(productService)

  return {
    productService,
    productController
  }
}

export {
  ProductService,
  ProductController
}

export * from './types'
