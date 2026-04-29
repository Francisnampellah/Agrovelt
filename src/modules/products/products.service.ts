import { PrismaClient } from '@prisma/client'
import { CreateProductRequest, CreateProductVariantRequest, CreateCategoryRequest } from './types'

export class ProductService {
  constructor(private prisma: PrismaClient) {}

  // Category Methods
  async createCategory(data: CreateCategoryRequest) {
    return this.prisma.category.create({ data })
  }

  async getAllCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' }
    })
  }

  // Product Methods
  async createProduct(data: CreateProductRequest) {
    if (data.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: data.categoryId }
      })
      if (!category) throw new Error('Category not found')
    }

    return this.prisma.product.create({
      data,
      include: { category: true }
    })
  }

  async getAllProducts() {
    return this.prisma.product.findMany({
      include: { 
        category: true,
        variants: true
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  async getProductById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: true
      }
    })
    if (!product) throw new Error('Product not found')
    return product
  }

  // Variant Methods
  async createVariant(data: CreateProductVariantRequest) {
    const product = await this.prisma.product.findUnique({
      where: { id: data.productId }
    })
    if (!product) throw new Error('Product not found')

    const existingVariant = await this.prisma.productVariant.findUnique({
      where: { sku: data.sku }
    })
    if (existingVariant) throw new Error('SKU already exists')

    return this.prisma.productVariant.create({
      data
    })
  }

  async getVariantsByProduct(productId: string) {
    return this.prisma.productVariant.findMany({
      where: { productId }
    })
  }
}
