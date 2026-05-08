import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import path from 'path'
import { AuthMiddleware, AuthService } from '../modules/auth'
import { createProductModule } from '../modules/products'
import { uploadProductImage } from '../utils/fileUpload'

const router = Router()

// Multer configuration for Excel file uploads
const excelStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/bulk-imports'))
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'products-' + uniqueSuffix + '.xlsx')
  }
})

const uploadExcel = multer({
  storage: excelStorage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ext === '.xlsx' || ext === '.xls') {
      cb(null, true)
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'))
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
})

// Function to create router with dependencies
export function createProductRoutes(prisma: PrismaClient) {
  const authMiddleware = new AuthMiddleware(new AuthService(prisma))
  const { productController } = createProductModule(prisma)

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all product categories
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       name: { type: string }
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/categories', authMiddleware.authenticate, productController.getAllCategories)

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Create a new product category
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 example: Fertilizers
 *     responses:
 *       201:
 *         description: Category created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     name: { type: string }
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/categories', authMiddleware.authenticate, productController.categoryValidation, productController.createCategory)

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Retrieve all products. Organization users see only their organization's products.
 *       SUPER_ADMIN users see all products.
 *     responses:
 *       200:
 *         description: List of products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/products', authMiddleware.authenticate, productController.getAllProducts)

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Product UUID
 *     responses:
 *       200:
 *         description: Product details including variants and category
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/products/:id', authMiddleware.authenticate, productController.getProductById)

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create a new product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Create a new product. Can optionally include an image in multipart/form-data.
 *       Authenticated user must belong to the specified organization.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, organizationId]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 example: Potassium Fertilizer
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: High quality NPK fertilizer for agriculture
 *               organizationId:
 *                 type: string
 *                 format: uuid
 *                 example: 123e4567-e89b-12d3-a456-426614174000
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               unit:
 *                 type: string
 *                 nullable: true
 *                 example: kg
 *               dosageInfo:
 *                 type: string
 *                 nullable: true
 *                 description: Dosage information for drugs/pesticides
 *               manufacturer:
 *                 type: string
 *                 nullable: true
 *                 example: ABC Chemicals Ltd
 *               isRestricted:
 *                 type: boolean
 *                 default: false
 *                 description: Flag for regulated chemicals
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       400:
 *         description: Invalid input or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/products', authMiddleware.authenticate, productController.productValidation, productController.createProduct)

/**
 * @swagger
 * /api/products/{id}/image:
 *   post:
 *     summary: Upload or update product image
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Product UUID
 *     description: |
 *       Upload an image for a product. Supports JPEG, PNG, GIF, and WebP formats.
 *       Maximum file size: 5MB. Replaces existing image if present.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file (JPEG, PNG, GIF, or WebP)
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Product image uploaded successfully
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       400:
 *         description: Invalid file format or size exceeds limit
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/products/:id/image', authMiddleware.authenticate, uploadProductImage.single('image'), productController.uploadProductImage)

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete a product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Product UUID
 *     description: Delete a product and its associated image file from storage.
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Product deleted successfully
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/products/:id', authMiddleware.authenticate, productController.deleteProduct)

/**
 * @swagger
 * /api/variants:
 *   post:
 *     summary: Create a new product variant
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Create a product variant (size/package option).
 *       SKU must be globally unique across the system.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, name, sku]
 *             properties:
 *               productId:
 *                 type: string
 *                 format: uuid
 *                 example: 123e4567-e89b-12d3-a456-426614174000
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 example: 1kg Bag
 *               sku:
 *                 type: string
 *                 minLength: 1
 *                 description: Stock Keeping Unit - must be unique globally
 *                 example: SKU-001-1KG
 *     responses:
 *       201:
 *         description: Variant created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     productId: { type: string, format: uuid }
 *                     name: { type: string }
 *                     sku: { type: string }
 *                     createdAt: { type: string, format: date-time }
 *       400:
 *         description: Invalid input or SKU already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/variants', authMiddleware.authenticate, productController.variantValidation, productController.createVariant)

/**
 * @swagger
 * /api/products/bulk/template:
 *   get:
 *     summary: Download Product import Excel template
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file template
 */
router.get('/products/bulk/template', authMiddleware.authenticate, productController.downloadProductTemplate)

router.post('/products/bulk/import', authMiddleware.authenticate, uploadExcel.single('file'), productController.bulkImportProducts)

  return router
}