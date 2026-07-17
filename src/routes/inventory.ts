import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import path from 'path'
import { AuthMiddleware, AuthService } from '../modules/auth'
import { createInventoryModule } from '../modules/inventory'

const router = Router()

// Multer configuration for Excel file uploads
const excelStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/bulk-imports'))
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'inventory-' + uniqueSuffix + '.xlsx')
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

export function createInventoryRoutes(prisma: PrismaClient) {
  const authMiddleware = new AuthMiddleware(new AuthService(prisma))
  const { inventoryController } = createInventoryModule(prisma)

/**
 * @swagger
 * /api/inventory/shops/{shopId}:
 *   get:
 *     summary: Get inventory levels for a shop
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Shop inventory levels
 */
router.get('/inventory/shops/:shopId', authMiddleware.authenticate, inventoryController.getByShop)

/**
 * @swagger
 * /api/inventory/update:
 *   post:
 *     summary: Set inventory level (upsert) for a specific variant batch
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shopId, variantId, quantity, costPrice]
 *             properties:
 *               shopId: { type: string }
 *               variantId: { type: string }
 *               batchNumber: { type: string, default: 'DEFAULT' }
 *               quantity: { type: integer, minimum: 0 }
 *               costPrice: { type: number, minimum: 0 }
 *               expiryDate: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Inventory updated
 *       400:
 *         description: Validation error or invalid inputs
 */
router.post('/inventory/update', authMiddleware.authenticate, inventoryController.updateValidation, inventoryController.update)

/**
 * @swagger
 * /api/inventory/adjust:
 *   post:
 *     summary: Adjust inventory level (increment or decrement) and record a transaction
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       change: 0 (with an existing batchNumber) is a price-only correction -
 *       it updates costPrice/sellingPrice on that exact batch without moving
 *       stock or logging a transaction row.
 *
 *       Positive changes for a MNYAMA_SHOP-sourced variant are rejected -
 *       Mnyama Shop stock can only be added via a confirmed Mnyama Shop
 *       purchase, not manual Stock In.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shopId, variantId, change, type]
 *             properties:
 *               shopId: { type: string }
 *               variantId: { type: string }
 *               batchNumber: { type: string, default: 'DEFAULT' }
 *               change: { type: integer, description: 'Positive to add stock, negative to remove, 0 for a price-only correction' }
 *               type: { type: string, enum: [PURCHASE, SALE, ADJUSTMENT, RETURN] }
 *               referenceId: { type: string }
 *               costPrice: { type: number, description: 'Required and must be > 0 when change >= 0' }
 *               sellingPriceOverride: { type: number, description: 'Sets the selling price for this batch directly instead of auto-calculating it from cost + markup' }
 *     responses:
 *       200:
 *         description: Inventory adjusted
 *       400:
 *         description: Validation error, insufficient stock, or attempted manual stock-in on a Mnyama Shop-sourced variant
 */
router.post('/inventory/adjust', authMiddleware.authenticate, inventoryController.adjustValidation, inventoryController.adjust)

/**
 * @swagger
 * /api/inventory/shops/{shopId}/transactions:
 *   get:
 *     summary: Get inventory transactions for a shop
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Shop inventory transactions
 */
router.get('/inventory/shops/:shopId/transactions', authMiddleware.authenticate, inventoryController.getTransactionsByShop)

/**
 * @swagger
 * /api/inventory/bulk/template/update:
 *   get:
 *     summary: Download the Excel template for bulk inventory update
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel (.xlsx) template file
 */
router.get('/inventory/bulk/template/update', authMiddleware.authenticate, inventoryController.downloadInventoryUpdateTemplate)

/**
 * @swagger
 * /api/inventory/bulk/template/adjust:
 *   get:
 *     summary: Download the Excel template for bulk inventory adjust
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel (.xlsx) template file
 */
router.get('/inventory/bulk/template/adjust', authMiddleware.authenticate, inventoryController.downloadInventoryAdjustTemplate)

/**
 * @swagger
 * /api/inventory/bulk/update:
 *   post:
 *     summary: Bulk update inventory from an Excel file
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Upload an Excel file (.xlsx) with inventory update data.
 *       Supports dry-run mode to validate without persisting.
 *
 *       Expected columns: shopId, variantId, batchNumber, quantity, costPrice, expiryDate
 *     parameters:
 *       - name: dryRun
 *         in: query
 *         required: false
 *         schema: { type: boolean, default: false }
 *         description: Validate without updating
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary, description: 'Excel file (.xlsx)' }
 *     responses:
 *       200:
 *         description: Bulk update result
 *       400:
 *         description: Invalid file or validation errors
 */
router.post('/inventory/bulk/update', authMiddleware.authenticate, uploadExcel.single('file'), inventoryController.bulkUpdateInventory)

/**
 * @swagger
 * /api/inventory/bulk/adjust:
 *   post:
 *     summary: Bulk adjust inventory from an Excel file
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Upload an Excel file (.xlsx) with inventory adjustment data.
 *       Supports dry-run mode to validate without persisting.
 *
 *       Expected columns: shopId, variantId, batchNumber, change, type, referenceId, costPrice
 *       Type must be one of: PURCHASE, SALE, ADJUSTMENT, RETURN
 *     parameters:
 *       - name: dryRun
 *         in: query
 *         required: false
 *         schema: { type: boolean, default: false }
 *         description: Validate without adjusting
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary, description: 'Excel file (.xlsx)' }
 *     responses:
 *       200:
 *         description: Bulk adjust result
 *       400:
 *         description: Invalid file or validation errors
 */
router.post('/inventory/bulk/adjust', authMiddleware.authenticate, uploadExcel.single('file'), inventoryController.bulkAdjustInventory)

  return router
}
