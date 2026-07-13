import { Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { body, query, validationResult } from 'express-validator'
import { loadAuthActor } from '../auth/assertActor'
import { canPurchase } from '../auth/permissions'
import { assertShopInScope } from '../auth/shopScope'
import { AuthenticatedRequest } from '../auth/types'
import { NotificationService } from '../notifications/notification.service'
import { PurchaseService } from './purchase.service'

export class PurchaseController {
  constructor(
    private purchaseService: PurchaseService,
    private notificationService: NotificationService,
    private prisma: PrismaClient
  ) {}

  createValidation = [
    body('shopId').isUUID().withMessage('Valid shop ID is required'),
    body('supplierId').optional().isUUID(),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.variantId').isString().notEmpty().withMessage('Valid variant ID is required'),
    body('items.*.quantity').isInt({ min: 1 }),
    body('items.*.costPrice').isFloat({ min: 0 }),
    body('items.*.batchNumber').optional().isString(),
    body('items.*.expiryDate').optional().isISO8601()
  ]

  listValidation = [
    query('shopId').isUUID().withMessage('Valid shop ID is required')
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
      if (!canPurchase(actor, true)) throw new Error('Insufficient permissions to create purchases')

      const items = req.body.items.map((item: any) => ({
        ...item,
        ...(item.expiryDate ? { expiryDate: new Date(item.expiryDate) } : {})
      }))

      const purchase = await this.purchaseService.createPurchase({
        shopId: req.body.shopId,
        supplierId: req.body.supplierId,
        items,
        createdBy: req.user.userId
      })

      if (!purchase) {
        return res.status(400).json({ error: 'Failed to create purchase' })
      }

      const notification = await this.notificationService.recordFromShopActivity(
        purchase.shopId,
        this.notificationService.fromPurchase(purchase)
      )

      res.status(201).json({ data: purchase, notification })
    } catch (error: any) {
      res.status(this.errorStatus(error)).json({ error: error.message })
    }
  }

  list = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const purchases = await this.purchaseService.getPurchasesByShop(String(req.query.shopId))
      res.json({ data: purchases })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  private errorStatus(error: unknown): number {
    const message = error instanceof Error ? error.message : ''
    return message.includes('Access denied') || message.includes('Insufficient permissions') ? 403 : 400
  }
}
