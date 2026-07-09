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

  // Deletes a product and every one of its variants together. ProductVariant
  // has ON DELETE RESTRICT against Product, so a plain product delete would
  // simply fail with a foreign-key error as soon as any variant exists —
  // this checks every variant for real usage first (same checks as
  // deleteVariant, minus its "last variant" rule, which doesn't apply here
  // since we're intentionally removing all of them together) and refuses
  // the whole operation — nothing is deleted — if any variant is in use.
  async deleteProduct(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: { select: { id: true, name: true, sku: true } } }
    })

    if (!product) throw new Error('Product not found')

    const blockedVariants: string[] = []
    for (const variant of product.variants) {
      const usageCount = await this.getVariantUsageCount(variant.id)
      if (usageCount > 0) {
        blockedVariants.push(`${variant.name} (SKU: ${variant.sku})`)
      }
    }

    if (blockedVariants.length > 0) {
      throw new Error(
        `Cannot delete product: variant(s) already used by inventory, pricing, purchases, sales, or transfers — ${blockedVariants.join(', ')}`
      )
    }

    await this.prisma.$transaction([
      this.prisma.productVariant.deleteMany({ where: { productId: id } }),
      this.prisma.product.delete({ where: { id } })
    ])

    // Delete image file only after the database delete succeeds
    if (product.imagePath) {
      deleteFile(product.imagePath)
    }

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

  // Shared by deleteVariant and deleteProduct's cascade — counts every
  // place a variant is referenced across inventory, pricing, purchases,
  // sales, and transfers.
  private async getVariantUsageCount(variantId: string): Promise<number> {
    const [
      inventoryCount,
      transactionCount,
      purchaseCount,
      saleCount,
      transferCount,
      shopPriceCount,
      priceHistoryCount
    ] = await Promise.all([
      this.prisma.inventory.count({ where: { variantId } }),
      this.prisma.inventoryTransaction.count({ where: { variantId } }),
      this.prisma.purchaseItem.count({ where: { variantId } }),
      this.prisma.saleItem.count({ where: { variantId } }),
      this.prisma.inventoryTransferItem.count({ where: { variantId } }),
      this.prisma.shopVariantPrice.count({ where: { variantId } }),
      this.prisma.priceHistory.count({ where: { variantId } })
    ])

    return (
      inventoryCount +
      transactionCount +
      purchaseCount +
      saleCount +
      transferCount +
      shopPriceCount +
      priceHistoryCount
    )
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

    const usageCount = await this.getVariantUsageCount(id)

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
