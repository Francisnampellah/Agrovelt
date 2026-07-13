import { Response } from 'express'
import { query, validationResult } from 'express-validator'
import { ReceiptStatus } from '@prisma/client'
import { PrismaClient } from '@prisma/client'
import { AuthenticatedRequest } from '../auth/types'
import { loadAuthActor } from '../auth/assertActor'
import { canDownloadReceipt } from '../auth/permissions'
import { assertShopInScope, resolveShopScope } from '../auth/shopScope'
import { assertOrganizationAccess } from '../organizations/organization-access'
import { ReceiptService } from './receipt.service'

export class ReceiptController {
  constructor(
    private receiptService: ReceiptService,
    private prisma: PrismaClient
  ) {}

  listValidation = [
    query('shopId').optional().isUUID().withMessage('Valid shop ID is required'),
    query('status').optional().isIn(['ISSUED', 'VOIDED']).withMessage('Invalid status'),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601()
  ]

  orgListValidation = [
    query('shopId').optional().isUUID(),
    query('status').optional().isIn(['ISSUED', 'VOIDED']),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601()
  ]

  private parseFilters(req: AuthenticatedRequest) {
    return {
      ...(req.query.shopId ? { shopId: String(req.query.shopId) } : {}),
      ...(req.query.status ? { status: String(req.query.status) as ReceiptStatus } : {}),
      ...(req.query.from ? { from: new Date(String(req.query.from)) } : {}),
      ...(req.query.to ? { to: new Date(String(req.query.to)) } : {})
    }
  }

  listByShop = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      if (!req.query.shopId) {
        return res.status(400).json({ error: 'shopId query parameter is required' })
      }

      await this.assertReceiptShopAccess(req, String(req.query.shopId))
      const receipts = await this.receiptService.getReceiptsByShop(
        String(req.query.shopId),
        this.parseFilters(req)
      )

      res.json({ data: receipts })
    } catch (error: any) {
      res.status(this.errorStatus(error)).json({ error: error.message })
    }
  }

  listByOrganization = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const organizationId = String(req.params.organizationId)
      await assertOrganizationAccess(this.prisma, req.user.userId, req.user.role, organizationId)
      const actor = await loadAuthActor(this.prisma, req)
      if (!canDownloadReceipt(actor, true)) {
        throw new Error('Insufficient permissions to access receipts')
      }

      if (req.query.shopId) {
        await assertShopInScope(this.prisma, actor, String(req.query.shopId))
      } else if (actor.role !== 'ADMIN' && actor.role !== 'SUPER_ADMIN') {
        const scope = await resolveShopScope(this.prisma, actor)
        if (!scope.allShops) {
          throw new Error('Access denied to receipts outside the assigned shop scope')
        }
      }

      const receipts = await this.receiptService.getReceiptsByOrganization(
        organizationId,
        this.parseFilters(req)
      )

      res.json({ data: receipts })
    } catch (error: any) {
      const status = error.message === 'Organization not found'
        ? 404
        : error.message === 'Access denied to this organization'
          ? 403
          : this.errorStatus(error)
      res.status(status).json({ error: error.message })
    }
  }

  getById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const receipt = await this.receiptService.getReceiptById(String(req.params.receiptId))
      await this.assertReceiptShopAccess(req, receipt.shopId)
      res.json({ data: receipt })
    } catch (error: any) {
      res.status(error.message === 'Receipt not found' ? 404 : this.errorStatus(error)).json({ error: error.message })
    }
  }

  getByNumber = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const receipt = await this.receiptService.getReceiptByNumber(String(req.params.receiptNumber))
      await this.assertReceiptShopAccess(req, receipt.shopId)
      res.json({ data: receipt })
    } catch (error: any) {
      res.status(error.message === 'Receipt not found' ? 404 : this.errorStatus(error)).json({ error: error.message })
    }
  }

  markPrinted = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existingReceipt = await this.receiptService.getReceiptById(String(req.params.receiptId))
      await this.assertReceiptShopAccess(req, existingReceipt.shopId)
      const receipt = await this.receiptService.markPrinted(String(req.params.receiptId))
      res.json({ message: 'Receipt marked as printed', data: receipt })
    } catch (error: any) {
      res.status(error.message === 'Receipt not found' ? 404 : this.errorStatus(error)).json({ error: error.message })
    }
  }

  voidReceipt = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existingReceipt = await this.receiptService.getReceiptById(String(req.params.receiptId))
      await this.assertReceiptShopAccess(req, existingReceipt.shopId)
      const receipt = await this.receiptService.voidReceipt(String(req.params.receiptId))
      res.json({ message: 'Receipt voided', data: receipt })
    } catch (error: any) {
      res.status(error.message === 'Receipt not found' ? 404 : this.errorStatus(error)).json({ error: error.message })
    }
  }

  private async assertReceiptShopAccess(req: AuthenticatedRequest, shopId: string): Promise<void> {
    const actor = await loadAuthActor(this.prisma, req)
    await assertShopInScope(this.prisma, actor, shopId)
    if (!canDownloadReceipt(actor, true)) {
      throw new Error('Insufficient permissions to access receipts')
    }
  }

  private errorStatus(error: unknown): number {
    const message = error instanceof Error ? error.message : ''
    return message.includes('Access denied') || message.includes('Insufficient permissions') ? 403 : 400
  }
}
