import { Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { body, query, validationResult } from 'express-validator'
import { loadAuthActor } from '../auth/assertActor'
import { canRefund, canSell } from '../auth/permissions'
import { assertShopInScope } from '../auth/shopScope'
import { AuthenticatedRequest } from '../auth/types'
import { NotificationService } from '../notifications/notification.service'
import { SaleCreationConflictError, SaleService } from './sale.service'
import { CreateSaleRequest } from './types'

export class SaleController {
  constructor(
    private saleService: SaleService,
    private notificationService: NotificationService,
    private prisma: PrismaClient
  ) {}

  createValidation = [
    body('shopId').isUUID().withMessage('Valid shop ID is required'),
    body('paymentMethod').isIn(['CASH', 'CARD', 'MOBILE']).withMessage('Invalid payment method'),
    body('items').isArray({ min: 1 }).withMessage('At least one sale item is required'),
    body('items.*.inventoryId').optional().isUUID().withMessage('inventoryId must be a valid UUID'),
    body('items.*.variantId').isString().notEmpty().withMessage('Valid variant ID is required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('items.*.price').optional().isFloat({ min: 0 }),
    body('items.*.batchNumber').optional().isString(),
    body('items.*.batch').optional().isString(),
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

      const actor = await loadAuthActor(this.prisma, req)
      await assertShopInScope(this.prisma, actor, String(req.body.shopId))
      if (!canSell(actor, true)) throw new Error('Insufficient permissions to create sales')

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
      const statusCode = error instanceof SaleCreationConflictError
        ? error.statusCode
        : this.errorStatus(error)
      res.status(statusCode).json({ error: error.message })
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

      const actor = await loadAuthActor(this.prisma, req)
      const existingSale = await this.saleService.getSaleById(String(req.params.saleId))
      await assertShopInScope(this.prisma, actor, existingSale.shopId)
      if (!canRefund(actor, true)) throw new Error('Insufficient permissions to refund sales')

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
      res.status(this.errorStatus(error)).json({ error: error.message })
    }
  }

  private errorStatus(error: unknown): number {
    const message = error instanceof Error ? error.message : ''
    return message.includes('Access denied') || message.includes('Insufficient permissions') ? 403 : 400
  }
}
