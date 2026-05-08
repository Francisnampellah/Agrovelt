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
 *     summary: Set inventory level (upsert)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shopId, variantId, quantity, costPrice, sellingPrice]
 *             properties:
 *               shopId: { type: string }
 *               variantId: { type: string }
 *               quantity: { type: integer }
 *               costPrice: { type: number }
 *               sellingPrice: { type: number }
 *     responses:
 *       200:
 *         description: Inventory updated
 */
router.post('/inventory/update', authMiddleware.authenticate, inventoryController.updateValidation, inventoryController.update)

/**
 * @swagger
 * /api/inventory/adjust:
 *   post:
 *     summary: Adjust inventory level and record transaction
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
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
 *               change: { type: integer }
 *               type: { type: string, enum: [PURCHASE, SALE, ADJUSTMENT, RETURN] }
 *               referenceId: { type: string }
 *     responses:
 *       200:
 *         description: Inventory adjusted
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

router.get('/inventory/bulk/template/update', authMiddleware.authenticate, inventoryController.downloadInventoryUpdateTemplate)
router.get('/inventory/bulk/template/adjust', authMiddleware.authenticate, inventoryController.downloadInventoryAdjustTemplate)

router.post('/inventory/bulk/update', authMiddleware.authenticate, uploadExcel.single('file'), inventoryController.bulkUpdateInventory)

router.post('/inventory/bulk/adjust', authMiddleware.authenticate, uploadExcel.single('file'), inventoryController.bulkAdjustInventory)

  return router
}
