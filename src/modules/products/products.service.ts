import { PrismaClient } from '@prisma/client'
import {
  CreateProductRequest,
  CreateProductVariantRequest,
  CreateCategoryRequest,
  UpdateProductRequest,
  UpdateProductVariantRequest
} from './types'
import { deleteFile, getFilePath } from '../../utils/fileUpload'

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

  async getCategoryNames(): Promise<string[]> {
    const categories = await this.prisma.category.findMany({
      select: { name: true },
      orderBy: { name: 'asc' }
    })
    return categories.map(cat => cat.name)
  }

  // Product Methods
  async createProduct(data: CreateProductRequest, imagePath?: string) {
    if (data.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: data.categoryId }
      })
      if (!category) throw new Error('Category not found')
    }

    const productData: any = {
      ...data,
      imagePath: imagePath ? imagePath : null,
      imageUrl: imagePath ? getFilePath(imagePath) : null,
      imageMimeType: data.imageMimeType || null
    }

    return this.prisma.product.create({
      data: productData,
      include: { category: true }
    })
  }

  async updateProduct(id: string, data: UpdateProductRequest) {
    const product = await this.prisma.product.findUnique({
      where: { id }
    })
    if (!product) throw new Error('Product not found')

    if (data.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: data.categoryId }
      })
      if (!category) throw new Error('Category not found')
    }

    return this.prisma.product.update({
      where: { id },
      data,
      include: {
        category: true,
        variants: true
      }
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

  async updateProductImage(productId: string, imagePath: string, mimeType: string) {
    // Get existing product to delete old image if exists
    const existingProduct = await this.prisma.product.findUnique({
      where: { id: productId }
    })

    if (!existingProduct) {
      throw new Error('Product not found')
    }

    // Delete old image if it exists
    if (existingProduct.imagePath) {
      deleteFile(existingProduct.imagePath)
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        imagePath,
        imageUrl: getFilePath(imagePath),
        imageMimeType: mimeType
      }
    })
  }

  async deleteProduct(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id }
    })

    if (!product) throw new Error('Product not found')

    // Delete image file if exists
    if (product.imagePath) {
      deleteFile(product.imagePath)
    }

    return this.prisma.product.delete({
      where: { id }
    })
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

    if (
      data.defaultCostPrice != null &&
      data.defaultSellingPrice != null &&
      Number(data.defaultSellingPrice) < Number(data.defaultCostPrice)
    ) {
      throw new Error('Default selling price cannot be less than default cost price')
    }

    return this.prisma.productVariant.create({
      data
    })
  }

  async updateVariant(id: string, data: UpdateProductVariantRequest) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id }
    })
    if (!variant) throw new Error('Variant not found')

    if (data.sku && data.sku !== variant.sku) {
      const existingVariant = await this.prisma.productVariant.findUnique({
        where: { sku: data.sku }
      })
      if (existingVariant) throw new Error('SKU already exists')
    }

    const effectiveCostPrice = data.defaultCostPrice ?? variant.defaultCostPrice
    const effectiveSellingPrice = data.defaultSellingPrice ?? variant.defaultSellingPrice
    if (
      effectiveCostPrice != null &&
      effectiveSellingPrice != null &&
      Number(effectiveSellingPrice) < Number(effectiveCostPrice)
    ) {
      throw new Error('Default selling price cannot be less than default cost price')
    }

    return this.prisma.productVariant.update({
      where: { id },
      data
    })
  }

  async deleteVariant(id: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
      select: { id: true, productId: true }
    })
    if (!variant) throw new Error('Variant not found')

    const variantCount = await this.prisma.productVariant.count({
      where: { productId: variant.productId }
    })
    if (variantCount <= 1) {
      throw new Error('Cannot delete the last variant for a product')
    }

    const [
      inventoryCount,
      transactionCount,
      purchaseCount,
      saleCount,
      transferCount,
      shopPriceCount,
      priceHistoryCount
    ] = await Promise.all([
      this.prisma.inventory.count({ where: { variantId: id } }),
      this.prisma.inventoryTransaction.count({ where: { variantId: id } }),
      this.prisma.purchaseItem.count({ where: { variantId: id } }),
      this.prisma.saleItem.count({ where: { variantId: id } }),
      this.prisma.inventoryTransferItem.count({ where: { variantId: id } }),
      this.prisma.shopVariantPrice.count({ where: { variantId: id } }),
      this.prisma.priceHistory.count({ where: { variantId: id } })
    ])

    const usageCount =
      inventoryCount +
      transactionCount +
      purchaseCount +
      saleCount +
      transferCount +
      shopPriceCount +
      priceHistoryCount

    if (usageCount > 0) {
      throw new Error('Cannot delete a variant that is already used by inventory, pricing, purchases, sales, or transfers')
    }

    return this.prisma.productVariant.delete({
      where: { id }
    })
  }

  async getVariantsByProduct(productId: string) {
    return this.prisma.productVariant.findMany({
      where: { productId }
    })
  }
}
