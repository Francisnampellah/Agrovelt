import { PrismaClient } from '@prisma/client'
import { CreateProductRequest, CreateProductVariantRequest, CreateCategoryRequest } from './types'
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

  async getAllProducts(organizationId?: string) {
    return this.prisma.product.findMany({
      where: organizationId ? { organizationId } : {},
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
