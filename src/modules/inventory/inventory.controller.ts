import { PrismaClient } from '@prisma/client'
import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { loadAuthActor } from '../auth/assertActor'
import { canAddStock, canViewShopFinance } from '../auth/permissions'
import { assertShopInScope } from '../auth/shopScope'
import { AuthenticatedRequest } from '../auth/types'
import { InventoryService } from './inventory.service'
import { BulkInventoryService } from './bulk-inventory.service'
import { parseExcelFile } from '../../utils/excelParser'
import { generateInventoryUpdateTemplate, generateInventoryAdjustTemplate, saveTemplate } from '../../utils/excelTemplateGenerator'

export class InventoryController {
  constructor(
    private inventoryService: InventoryService,
    private bulkInventoryService: BulkInventoryService,
    private prisma: PrismaClient
  ) {}

  updateValidation = [
    body('shopId').isUUID().withMessage('Invalid shop ID'),
    body('variantId').isString().notEmpty().withMessage('Invalid variant ID'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be >= 0'),
    body('costPrice').isFloat({ min: 0 }).withMessage('Cost price must be >= 0')
  ]

  adjustValidation = [
    body('shopId').isUUID().withMessage('Invalid shop ID'),
    body('variantId').isString().notEmpty().withMessage('Invalid variant ID'),
    body('batchNumber').optional().isString().notEmpty().withMessage('Invalid batch number'),
    body('change').isInt().withMessage('Change must be an integer'),
    body('type').isIn(['PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN']).withMessage('Invalid transaction type'),
    body('referenceId').optional().isString(),
    body('costPrice').optional().isFloat({ min: 0 }).withMessage('Cost price must be >= 0'),
    body('sellingPriceOverride')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Selling price override must be >= 0')
  ]

  update = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      await this.assertStockAccess(req, [String(req.body.shopId)])
      const inventory = await this.inventoryService.updateInventory(req.body)
      res.json({ data: inventory })
    } catch (error: any) {
      res.status(this.errorStatus(error)).json({ error: error.message })
    }
  }

  adjust = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      await this.assertStockAccess(req, [String(req.body.shopId)])
      const inventory = await this.inventoryService.adjustInventory({
        ...req.body,
        changedBy: req.user?.userId
      })
      res.json({ data: inventory })
    } catch (error: any) {
      res.status(this.errorStatus(error)).json({ error: error.message })
    }
  }

  getByShop = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const shopId = String(req.params.shopId)
      await this.assertInventoryReadAccess(req, shopId)
      const inventory = await this.inventoryService.getInventoryByShop(shopId)
      res.json({ data: inventory })
    } catch (error: any) {
      res.status(this.errorStatus(error)).json({ error: error.message })
    }
  }

  getTransactionsByShop = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const shopId = String(req.params.shopId)
      await this.assertInventoryReadAccess(req, shopId)
      const transactions = await this.inventoryService.getTransactionsByShop(shopId)
      res.json({ data: transactions })
    } catch (error: any) {
      res.status(this.errorStatus(error)).json({ error: error.message })
    }
  }

  bulkUpdateInventory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!(req as any).file) {
        return res.status(400).json({ error: 'No Excel file provided' })
      }

      const dryRun = String(req.query.dryRun) === 'true'
      const rows = await parseExcelFile((req as any).file.path)
      await this.assertStockAccess(req, rows.map((row: { shopId?: string }) => row.shopId).filter(Boolean))
      const user = req.user!
      
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
      res.status(this.errorStatus(error)).json({ error: error.message })
    }
  }

  bulkAdjustInventory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!(req as any).file) {
        return res.status(400).json({ error: 'No Excel file provided' })
      }

      const dryRun = String(req.query.dryRun) === 'true'
      const rows = await parseExcelFile((req as any).file.path)
      await this.assertStockAccess(req, rows.map((row: { shopId?: string }) => row.shopId).filter(Boolean))
      const user = req.user!
      
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
      res.status(this.errorStatus(error)).json({ error: error.message })
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

  private async assertStockAccess(req: AuthenticatedRequest, shopIds: (string | undefined)[]): Promise<void> {
    const actor = await loadAuthActor(this.prisma, req)
    if (!canAddStock(actor, true)) throw new Error('Insufficient permissions to modify inventory')

    for (const shopId of new Set(shopIds.filter((value): value is string => Boolean(value)))) {
      await assertShopInScope(this.prisma, actor, shopId)
    }
  }

  private async assertInventoryReadAccess(req: AuthenticatedRequest, shopId: string): Promise<void> {
    const actor = await loadAuthActor(this.prisma, req)
    await assertShopInScope(this.prisma, actor, shopId)
    if (!canViewShopFinance(actor, true)) throw new Error('Insufficient permissions to view inventory')
  }

  private errorStatus(error: unknown): number {
    const message = error instanceof Error ? error.message : ''
    return message.includes('Access denied') || message.includes('Insufficient permissions') ? 403 : 400
  }
}
