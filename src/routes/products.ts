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
 *       Retrieve all products from the global shared catalog.
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
 * /api/products/sync/mnyama-shop:
 *   post:
 *     summary: Sync Mnyama Shop Firestore products into the Agrovet catalog
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Imports published Mnyama Shop products from Firestore into the Agrovet
 *       global product catalog. Uses `agrovet_catalog.product_id` for Product.id and
 *       `agrovet_catalog.variant_id` for ProductVariant.id when present.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dryRun:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Sync summary
 *       403:
 *         description: Admin or super admin role required
 */
router.post(
  '/products/sync/mnyama-shop',
  authMiddleware.authenticate,
  authMiddleware.authorize('SUPER_ADMIN', 'ADMIN'),
  productController.syncMnyamaShopCatalog
)

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
 *       Create a new product in the global shared catalog. Can optionally include an image in multipart/form-data.
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
 *                 example: Potassium Fertilizer
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: High quality NPK fertilizer for agriculture
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
router.post(
  '/products',
  authMiddleware.authenticate,
  authMiddleware.authorize('SUPER_ADMIN', 'ADMIN'),
  productController.productValidation,
  productController.createProduct
)

/**
 * @swagger
 * /api/products/{id}:
 *   patch:
 *     summary: Update a product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string, nullable: true }
 *               categoryId: { type: string, format: uuid, nullable: true }
 *               unit: { type: string, nullable: true }
 *               dosageInfo: { type: string, nullable: true }
 *               manufacturer: { type: string, nullable: true }
 *               isRestricted: { type: boolean }
 *     responses:
 *       200:
 *         description: Product updated
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
 *       404:
 *         description: Product not found
 */
router.patch(
  '/products/:id',
  authMiddleware.authenticate,
  authMiddleware.authorize('SUPER_ADMIN', 'ADMIN'),
  productController.productUpdateValidation,
  productController.updateProduct
)

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
router.delete(
  '/products/:id',
  authMiddleware.authenticate,
  authMiddleware.authorize('SUPER_ADMIN', 'ADMIN'),
  productController.deleteProduct
)

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
 *               defaultCostPrice:
 *                 type: number
 *                 nullable: true
 *                 example: 9000
 *               defaultSellingPrice:
 *                 type: number
 *                 nullable: true
 *                 example: 12000
 *               markupPercent:
 *                 type: number
 *                 nullable: true
 *                 example: 20
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
 *                     defaultCostPrice: { type: number, nullable: true }
 *                     defaultSellingPrice: { type: number, nullable: true }
 *                     markupPercent: { type: number, nullable: true }
 *                     createdAt: { type: string, format: date-time }
 *       400:
 *         description: Invalid input or SKU already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/variants',
  authMiddleware.authenticate,
  authMiddleware.authorize('SUPER_ADMIN', 'ADMIN'),
  productController.variantValidation,
  productController.createVariant
)

/**
 * @swagger
 * /api/variants/{id}:
 *   patch:
 *     summary: Update a product variant
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               sku:
 *                 type: string
 *                 description: Stock Keeping Unit - must be unique globally
 *               defaultCostPrice: { type: number, nullable: true }
 *               defaultSellingPrice:
 *                 type: number
 *                 nullable: true
 *                 description: Must not be less than defaultCostPrice
 *               markupPercent: { type: number, nullable: true }
 *     responses:
 *       200:
 *         description: Variant updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/ProductVariant'
 *       400:
 *         description: Invalid input, SKU already exists, or selling price below cost price
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Variant not found
 *
 *   delete:
 *     summary: Delete a product variant
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Blocked if this is the product's last remaining variant, or if the
 *       variant is referenced by inventory, purchases, sales, transfers, or
 *       price history.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Variant deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Variant deleted successfully }
 *       400:
 *         description: Cannot delete the last variant, or a variant already in use
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Variant not found
 */
router.patch(
  '/variants/:id',
  authMiddleware.authenticate,
  authMiddleware.authorize('SUPER_ADMIN', 'ADMIN'),
  productController.variantUpdateValidation,
  productController.updateVariant
)

router.delete(
  '/variants/:id',
  authMiddleware.authenticate,
  authMiddleware.authorize('SUPER_ADMIN', 'ADMIN'),
  productController.deleteVariant
)

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
