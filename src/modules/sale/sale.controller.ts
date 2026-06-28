import { Response } from 'express'
import { body, query, validationResult } from 'express-validator'
import { AuthenticatedRequest } from '../auth/types'
import { NotificationService } from '../notifications/notification.service'
import { SaleService } from './sale.service'
import { CreateSaleRequest } from './types'

export class SaleController {
  constructor(
    private saleService: SaleService,
    private notificationService: NotificationService
  ) {}

  createValidation = [
    body('shopId').isUUID().withMessage('Valid shop ID is required'),
    body('paymentMethod').isIn(['CASH', 'CARD', 'MOBILE']).withMessage('Invalid payment method'),
    body('items').isArray({ min: 1 }).withMessage('At least one sale item is required'),
    body('items.*.variantId').isUUID().withMessage('Valid variant ID is required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('items.*.price').optional().isFloat({ min: 0 }),
    body('items.*.batchNumber').optional().isString(),
    body('discount').optional().isFloat({ min: 0 }),
    body('tax').optional().isFloat({ min: 0 }),
    body('total').optional().isFloat({ min: 0 })
  ]

  listValidation = [
    query('shopId').isUUID().withMessage('Valid shop ID is required')
  ]

  refundValidation = [
    body('refundedBy').optional().isUUID()
  ]

  create = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const payload: CreateSaleRequest = {
        ...req.body,
        createdBy: req.user.userId
      }

      const sale = await this.saleService.createSale(payload)
      if (!sale) {
        return res.status(400).json({ error: 'Failed to create sale' })
      }

      const shop = await this.saleService.getSaleShop(sale.shopId)
      const notification = await this.notificationService.recordFromShopActivity(
        sale.shopId,
        this.notificationService.fromSale({
          id: sale.id,
          shopId: sale.shopId,
          total: sale.total,
          status: sale.status,
          createdAt: sale.createdAt,
          ...(shop ? { shop: { name: shop.name } } : {})
        })
      )

      res.status(201).json({ data: sale, receipt: sale.receipt, notification })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  list = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const shopId = String(req.query.shopId)
      const sales = await this.saleService.getSalesByShop(shopId)
      res.json({ data: sales })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  getById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sale = await this.saleService.getSaleById(String(req.params.saleId))
      res.json({ data: sale })
    } catch (error: any) {
      res.status(error.message === 'Sale not found' ? 404 : 400).json({ error: error.message })
    }
  }

  refund = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const refundedBy = req.body.refundedBy || req.user.userId
      const sale = await this.saleService.refundSale(String(req.params.saleId), refundedBy)
      if (!sale) {
        return res.status(400).json({ error: 'Failed to refund sale' })
      }

      const shop = await this.saleService.getSaleShop(sale.shopId)
      const notification = await this.notificationService.recordFromShopActivity(
        sale.shopId,
        this.notificationService.fromSale({
          id: sale.id,
          shopId: sale.shopId,
          total: sale.total,
          status: sale.status,
          createdAt: sale.createdAt,
          ...(shop ? { shop: { name: shop.name } } : {})
        })
      )

      res.json({ message: 'Sale refunded successfully', data: sale, receipt: sale.receipt, notification })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }
}
