import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { ProductService } from './products.service'

export class ProductController {
  constructor(private productService: ProductService) {}

  categoryValidation = [
    body('name').trim().notEmpty().withMessage('Category name is required')
  ]

  productValidation = [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('description').optional().trim(),
    body('categoryId').optional().isUUID().withMessage('Invalid category ID'),
    body('organizationId').isUUID().withMessage('Valid organization ID is required'),
    body('unit').optional().isString(),
    body('dosageInfo').optional().isString(),
    body('manufacturer').optional().isString(),
    body('isRestricted').optional().isBoolean()
  ]

  variantValidation = [
    body('productId').isUUID().withMessage('Valid product ID is required'),
    body('name').trim().notEmpty().withMessage('Variant name is required'),
    body('sku').trim().notEmpty().withMessage('SKU is required')
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
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const product = await this.productService.createProduct(req.body)
      res.status(201).json({ data: product })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  getAllProducts = async (req: Request, res: Response) => {
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
}
