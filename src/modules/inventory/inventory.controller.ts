import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { InventoryService } from './inventory.service'

export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  updateValidation = [
    body('shopId').isUUID().withMessage('Invalid shop ID'),
    body('variantId').isUUID().withMessage('Invalid variant ID'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be >= 0'),
    body('costPrice').isFloat({ min: 0 }).withMessage('Cost price must be >= 0'),
    body('sellingPrice').isFloat({ min: 0 }).withMessage('Selling price must be >= 0')
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
      const { shopId } = req.params
      const inventory = await this.inventoryService.getInventoryByShop(shopId)
      res.json({ data: inventory })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  getTransactionsByShop = async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params
      const transactions = await this.inventoryService.getTransactionsByShop(shopId)
      res.json({ data: transactions })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
}
