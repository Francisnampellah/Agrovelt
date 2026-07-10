import { Request, Response } from 'express'
import { body, validationResult, query } from 'express-validator'
import { ProductService } from './products.service'
import { BulkProductService } from './bulk-products.service'
import { seedProductsFromFirebase } from './firebase-catalog-seed.service'
import { parseExcelFile } from '../../utils/excelParser'
import { generateProductTemplate, saveTemplate } from '../../utils/excelTemplateGenerator'
import { PrismaClient } from '@prisma/client'

export class ProductController {
  constructor(
    private productService: ProductService,
    private bulkProductService: BulkProductService,
    private prisma?: PrismaClient
  ) {}

  categoryValidation = [
    body('name').trim().notEmpty().withMessage('Category name is required')
  ]

  productValidation = [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('description').optional().trim(),
    body('categoryId').optional({ nullable: true }).isUUID().withMessage('Invalid category ID'),
    body('unit').optional().isString(),
    body('dosageInfo').optional().isString(),
    body('manufacturer').optional().isString(),
    body('isRestricted').optional().isBoolean()
  ]

  productUpdateValidation = [
    body('name').optional().trim().notEmpty().withMessage('Product name cannot be empty'),
    body('description').optional({ nullable: true }).trim(),
    body('categoryId').optional({ nullable: true }).isUUID().withMessage('Invalid category ID'),
    body('unit').optional({ nullable: true }).isString(),
    body('dosageInfo').optional({ nullable: true }).isString(),
    body('manufacturer').optional({ nullable: true }).isString(),
    body('isRestricted').optional().isBoolean()
  ]

  variantValidation = [
    body('productId').isString().notEmpty().withMessage('Valid product ID is required'),
    body('name').trim().notEmpty().withMessage('Variant name is required'),
    body('sku').optional({ checkFalsy: true }).trim(),
    body('defaultCostPrice').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Default cost price must be 0 or greater').toFloat(),
    body('defaultSellingPrice').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Default selling price must be 0 or greater').toFloat()
      .custom((value, { req }) => {
        const costPrice = req.body.defaultCostPrice
        if (value != null && costPrice != null && Number(value) < Number(costPrice)) {
          throw new Error('Default selling price cannot be less than default cost price')
        }
        return true
      }),
    body('markupPercent').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Markup percent must be 0 or greater').toFloat()
  ]

  variantUpdateValidation = [
    body('name').optional().trim().notEmpty().withMessage('Variant name cannot be empty'),
    body('sku').optional().trim().notEmpty().withMessage('SKU cannot be empty'),
    body('defaultCostPrice').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Default cost price must be 0 or greater').toFloat(),
    body('defaultSellingPrice').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Default selling price must be 0 or greater').toFloat()
      .custom((value, { req }) => {
        const costPrice = req.body.defaultCostPrice
        if (value != null && costPrice != null && Number(value) < Number(costPrice)) {
          throw new Error('Default selling price cannot be less than default cost price')
        }
        return true
      }),
    body('markupPercent').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Markup percent must be 0 or greater').toFloat()
  ]

  createCategory = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const category = await this.productService.createCategory(req.body)
      res.status(201).json({ data: category })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  getAllCategories = async (req: Request, res: Response) => {
    try {
      const categories = await this.productService.getAllCategories()
      res.json({ data: categories })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  createProduct = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        // Clean up uploaded file if validation fails
        if ((req as any).file) {
          const fs = await import('fs').then(m => m.promises)
          await fs.unlink((req as any).file.path).catch(() => {})
        }
        return res.status(400).json({ errors: errors.array() })
      }

      let imagePath: string | undefined
      let mimeType: string | undefined

      if ((req as any).file) {
        imagePath = (req as any).file.filename
        mimeType = (req as any).file.mimetype
      }

      const product = await this.productService.createProduct(req.body, imagePath)
      res.status(201).json({ data: product })
    } catch (error: any) {
      // Clean up uploaded file if product creation fails
      if ((req as any).file) {
        const fs = await import('fs').then(m => m.promises)
        await fs.unlink((req as any).file.path).catch(() => {})
      }
      res.status(400).json({ error: error.message })
    }
  }

  updateProduct = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const product = await this.productService.updateProduct(String(req.params.id), req.body)
      res.json({ data: product })
    } catch (error: any) {
      const status = error.message === 'Product not found' ? 404 : 400
      res.status(status).json({ error: error.message })
    }
  }

  getAllProducts = async (_req: Request, res: Response) => {
    try {
      const products = await this.productService.getAllProducts()
      res.json({ data: products })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  getProductById = async (req: Request, res: Response) => {
    try {
      const product = await this.productService.getProductById(String(req.params.id))
      res.json({ data: product })
    } catch (error: any) {
      const status = error.message === 'Product not found' ? 404 : 400
      res.status(status).json({ error: error.message })
    }
  }

  uploadProductImage = async (req: Request, res: Response) => {
    try {
      if (!(req as any).file) {
        return res.status(400).json({ error: 'No image file provided' })
      }

      const productId = String(req.params.id)
      const imagePath = (req as any).file.filename
      const mimeType = (req as any).file.mimetype

      const product = await this.productService.updateProductImage(productId, imagePath, mimeType)
      res.json({ 
        message: 'Product image uploaded successfully',
        data: product 
      })
    } catch (error: any) {
      // Clean up uploaded file on error
      if ((req as any).file) {
        const fs = await import('fs').then(m => m.promises)
        await fs.unlink((req as any).file.path).catch(() => {})
      }
      const status = error.message === 'Product not found' ? 404 : 400
      res.status(status).json({ error: error.message })
    }
  }

  deleteProduct = async (req: Request, res: Response) => {
    try {
      const productId = String(req.params.id)
      await this.productService.deleteProduct(productId)
      res.json({ message: 'Product deleted successfully' })
    } catch (error: any) {
      const status = error.message === 'Product not found' ? 404 : 400
      res.status(status).json({ error: error.message })
    }
  }

  createVariant = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const variant = await this.productService.createVariant(req.body)
      res.status(201).json({ data: variant })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  updateVariant = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const variant = await this.productService.updateVariant(String(req.params.id), req.body)
      res.json({ data: variant })
    } catch (error: any) {
      const status = error.message === 'Variant not found' ? 404 : 400
      res.status(status).json({ error: error.message })
    }
  }

  deleteVariant = async (req: Request, res: Response) => {
    try {
      await this.productService.deleteVariant(String(req.params.id))
      res.json({ message: 'Variant deleted successfully' })
    } catch (error: any) {
      const status = error.message === 'Variant not found' ? 404 : 400
      res.status(status).json({ error: error.message })
    }
  }

  bulkImportProducts = async (req: Request, res: Response) => {
    try {
      if (!(req as any).file) {
        return res.status(400).json({ error: 'No Excel file provided' })
      }

      const dryRun = String(req.query.dryRun) === 'true'

      const rows = await parseExcelFile((req as any).file.path)
      
      // Clean up uploaded file
      const fs = await import('fs').then(m => m.promises)
      await fs.unlink((req as any).file.path).catch(() => {})

      const result = await this.bulkProductService.bulkImportProducts(rows, dryRun)
      
      const statusCode = result.success ? 200 : 400
      res.status(statusCode).json(result)
    } catch (error: any) {
      // Clean up file on error
      if ((req as any).file) {
        const fs = await import('fs').then(m => m.promises)
        await fs.unlink((req as any).file.path).catch(() => {})
      }
      res.status(400).json({ error: error.message })
    }
  }

  downloadProductTemplate = async (req: Request, res: Response) => {
    try {
      const categories = await this.productService.getCategoryNames()
      const workbook = await generateProductTemplate(categories)
      const filePath = await saveTemplate(workbook, 'products_template.xlsx')
      
      res.download(filePath, 'products_template.xlsx', (err) => {
        if (err) console.error('Download error:', err)
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  syncMnyamaShopCatalog = async (req: Request, res: Response) => {
    try {
      if (!this.prisma) {
        return res.status(500).json({ error: 'Prisma client is not configured' })
      }

      const dryRun = req.body?.dryRun === true || String(req.query.dryRun) === 'true'
      const result = await seedProductsFromFirebase(this.prisma, {
        ...(process.env.FIREBASE_PRODUCTS_COLLECTION
          ? { productsCollection: process.env.FIREBASE_PRODUCTS_COLLECTION }
          : {}),
        publishedOnly: process.env.FIREBASE_PUBLISHED_ONLY !== 'false',
        dryRun
      })

      res.json({ data: result })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }
}
