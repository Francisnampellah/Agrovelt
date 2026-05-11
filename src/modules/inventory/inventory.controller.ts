import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { InventoryService } from './inventory.service'
import { BulkInventoryService } from './bulk-inventory.service'
import { parseExcelFile } from '../../utils/excelParser'
import { generateInventoryUpdateTemplate, generateInventoryAdjustTemplate, saveTemplate } from '../../utils/excelTemplateGenerator'

export class InventoryController {
  constructor(
    private inventoryService: InventoryService,
    private bulkInventoryService: BulkInventoryService
  ) {}

  updateValidation = [
    body('shopId').isUUID().withMessage('Invalid shop ID'),
    body('variantId').isUUID().withMessage('Invalid variant ID'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be >= 0'),
    body('costPrice').isFloat({ min: 0 }).withMessage('Cost price must be >= 0')
  ]

  adjustValidation = [
    body('shopId').isUUID().withMessage('Invalid shop ID'),
    body('variantId').isUUID().withMessage('Invalid variant ID'),
    body('change').isInt().withMessage('Change must be an integer'),
    body('type').isIn(['PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN']).withMessage('Invalid transaction type'),
    body('referenceId').optional().isString()
  ]

  update = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const inventory = await this.inventoryService.updateInventory(req.body)
      res.json({ data: inventory })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  adjust = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const inventory = await this.inventoryService.adjustInventory(req.body)
      res.json({ data: inventory })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  getByShop = async (req: Request, res: Response) => {
    try {
      const shopId = String(req.params.shopId)
      const inventory = await this.inventoryService.getInventoryByShop(shopId)
      res.json({ data: inventory })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  getBatchesByVariant = async (req: Request, res: Response) => {
    try {
      const shopId = String(req.params.shopId)
      const variantId = String(req.params.variantId)
      const batches = await this.inventoryService.getBatchesByVariant(shopId, variantId)
      res.json({ data: batches })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  getTransactionsByShop = async (req: Request, res: Response) => {
    try {
      const shopId = String(req.params.shopId)
      const transactions = await this.inventoryService.getTransactionsByShop(shopId)
      res.json({ data: transactions })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  bulkUpdateInventory = async (req: Request, res: Response) => {
    try {
      if (!(req as any).file) {
        return res.status(400).json({ error: 'No Excel file provided' })
      }

      const dryRun = String(req.query.dryRun) === 'true'
      const rows = parseExcelFile((req as any).file.path)
      const user = (req as any).user

      if (!user) {
        return res.status(401).json({ error: 'User authentication required' })
      }
      
      // Clean up uploaded file
      const fs = await import('fs').then(m => m.promises)
      await fs.unlink((req as any).file.path).catch(() => {})

      const result = await this.bulkInventoryService.bulkUpdateInventory(rows, user, dryRun)
      
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

  bulkAdjustInventory = async (req: Request, res: Response) => {
    try {
      if (!(req as any).file) {
        return res.status(400).json({ error: 'No Excel file provided' })
      }

      const dryRun = String(req.query.dryRun) === 'true'
      const rows = parseExcelFile((req as any).file.path)
      const user = (req as any).user

      if (!user) {
        return res.status(401).json({ error: 'User authentication required' })
      }
      
      // Clean up uploaded file
      const fs = await import('fs').then(m => m.promises)
      await fs.unlink((req as any).file.path).catch(() => {})

      const result = await this.bulkInventoryService.bulkAdjustInventory(rows, user, dryRun)
      
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

  downloadInventoryUpdateTemplate = async (req: Request, res: Response) => {
    try {
      const workbook = await generateInventoryUpdateTemplate()
      const filePath = await saveTemplate(workbook, 'inventory_update_template.xlsx')
      
      res.download(filePath, 'inventory_update_template.xlsx', (err) => {
        if (err) console.error('Download error:', err)
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  downloadInventoryAdjustTemplate = async (req: Request, res: Response) => {
    try {
      const workbook = await generateInventoryAdjustTemplate()
      const filePath = await saveTemplate(workbook, 'inventory_adjust_template.xlsx')
      
      res.download(filePath, 'inventory_adjust_template.xlsx', (err) => {
        if (err) console.error('Download error:', err)
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
}
