import { Response } from 'express'
import { query, validationResult } from 'express-validator'
import { ReceiptStatus } from '@prisma/client'
import { PrismaClient } from '@prisma/client'
import { AuthenticatedRequest } from '../auth/types'
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

      const receipts = await this.receiptService.getReceiptsByShop(
        String(req.query.shopId),
        this.parseFilters(req)
      )

      res.json({ data: receipts })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
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
          : 400
      res.status(status).json({ error: error.message })
    }
  }

  getById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const receipt = await this.receiptService.getReceiptById(String(req.params.receiptId))
      res.json({ data: receipt })
    } catch (error: any) {
      res.status(error.message === 'Receipt not found' ? 404 : 400).json({ error: error.message })
    }
  }

  getByNumber = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const receipt = await this.receiptService.getReceiptByNumber(String(req.params.receiptNumber))
      res.json({ data: receipt })
    } catch (error: any) {
      res.status(error.message === 'Receipt not found' ? 404 : 400).json({ error: error.message })
    }
  }

  markPrinted = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const receipt = await this.receiptService.markPrinted(String(req.params.receiptId))
      res.json({ message: 'Receipt marked as printed', data: receipt })
    } catch (error: any) {
      res.status(error.message === 'Receipt not found' ? 404 : 400).json({ error: error.message })
    }
  }

  voidReceipt = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const receipt = await this.receiptService.voidReceipt(String(req.params.receiptId))
      res.json({ message: 'Receipt voided', data: receipt })
    } catch (error: any) {
      res.status(error.message === 'Receipt not found' ? 404 : 400).json({ error: error.message })
    }
  }
}
