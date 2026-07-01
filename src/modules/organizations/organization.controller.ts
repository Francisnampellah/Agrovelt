import { Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { body, query, validationResult } from 'express-validator'
import { AuthenticatedRequest } from '../auth/types'
import { AuthService } from '../auth/auth.service'
import { ExpenseService } from '../expense/expense.service'
import { NotificationService } from '../notifications/notification.service'
import { PurchaseService } from '../purchase/purchase.service'
import { SaleService } from '../sale/sale.service'
import { InventoryService } from '../inventory/inventory.service'
import { ShopService } from '../shops/shop.service'
import { assertOrganizationAccess } from './organization-access'
import { OrganizationService } from './organization.service'
import { CreateOrganizationRequest } from './types'
import { formatCollectorAuthResponse } from '../auth/collectorResponse'

export class OrganizationController {
  constructor(
    private organizationService: OrganizationService,
    private authService: AuthService,
    private prisma: PrismaClient,
    private saleService: SaleService,
    private expenseService: ExpenseService,
    private purchaseService: PurchaseService,
    private notificationService: NotificationService,
    private inventoryService: InventoryService,
    private shopService: ShopService
  ) {}

  createValidation = [
    body('name').trim().notEmpty().withMessage('Organization name is required').isLength({ min: 2, max: 100 }),
    body('slug').trim().notEmpty().withMessage('Slug is required').isLowercase().withMessage('Slug must be lowercase').matches(/^[a-z0-9-]+$/).withMessage('Slug can only contain letters, numbers and hyphens'),
    body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email format'),
    body('phoneNumber').optional().trim()
  ]

  updateValidation = [
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('slug').optional().trim().isLowercase().withMessage('Slug must be lowercase').matches(/^[a-z0-9-]+$/).withMessage('Slug can only contain letters, numbers and hyphens'),
    body('email').optional().trim().isEmail().withMessage('Invalid email format'),
    body('phoneNumber').optional().trim()
  ]

  create = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const data: CreateOrganizationRequest = req.body
      const result = await this.organizationService.createOrganizationForUser(req.user.userId, data)
      const session = await this.authService.createSessionForUser(result.user.id)

      const user = {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        organizationId: result.user.organizationId,
        isActive: true
      }

      res.status(201).json(
        formatCollectorAuthResponse(
          'Organization created and linked to your account',
          session,
          user,
          { organization: result.organization }
        )
      )
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  getAll = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgs = await this.organizationService.getAllOrganizations()
      res.json({ data: orgs })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  getById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const org = await this.organizationService.getOrganizationById(String(req.params.id))
      res.json({ data: org })
    } catch (error: any) {
      res.status(error.message === 'Organization not found' ? 404 : 400).json({ error: error.message })
    }
  }

  update = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const org = await this.organizationService.updateOrganization(String(req.params.id), req.body)
      res.json({ data: org })
    } catch (error: any) {
      res.status(error.message === 'Organization not found' ? 404 : 400).json({ error: error.message })
    }
  }

  notificationsValidation = [
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200')
  ]

  stockTransactionsValidation = [
    query('shopId').optional().isUUID().withMessage('Valid shop ID is required'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200'),
    query('cursor').optional().isUUID().withMessage('Cursor must be a valid UUID')
  ]

  stockSummaryValidation = [
    query('lowStockThreshold').optional().isInt({ min: 0 }).withMessage('lowStockThreshold must be >= 0')
  ]

  private orgErrorStatus(message: string): number {
    if (message === 'Organization not found') return 404
    if (message === 'Access denied to this organization') return 403
    return 400
  }

  private async assertOrgAccess(req: AuthenticatedRequest, organizationId: string) {
    if (!req.user) {
      throw Object.assign(new Error('Authentication required'), { status: 401 })
    }
    await assertOrganizationAccess(this.prisma, req.user.userId, req.user.role, organizationId)
  }

  getSales = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const organizationId = String(req.params.id)
      await assertOrganizationAccess(this.prisma, req.user.userId, req.user.role, organizationId)

      const sales = await this.saleService.getSalesByOrganization(organizationId)
      res.json({ data: sales })
    } catch (error: any) {
      const status = error.message === 'Organization not found'
        ? 404
        : error.message === 'Access denied to this organization'
          ? 403
          : 400
      res.status(status).json({ error: error.message })
    }
  }

  getExpenses = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const organizationId = String(req.params.id)
      await assertOrganizationAccess(this.prisma, req.user.userId, req.user.role, organizationId)

      const expenses = await this.expenseService.getExpensesByOrganization(organizationId)
      res.json({ data: expenses })
    } catch (error: any) {
      const status = error.message === 'Organization not found'
        ? 404
        : error.message === 'Access denied to this organization'
          ? 403
          : 400
      res.status(status).json({ error: error.message })
    }
  }

  getPurchases = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const organizationId = String(req.params.id)
      await assertOrganizationAccess(this.prisma, req.user.userId, req.user.role, organizationId)

      const purchases = await this.purchaseService.getPurchasesByOrganization(organizationId)
      res.json({ data: purchases })
    } catch (error: any) {
      const status = error.message === 'Organization not found'
        ? 404
        : error.message === 'Access denied to this organization'
          ? 403
          : 400
      res.status(status).json({ error: error.message })
    }
  }

  getNotifications = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const organizationId = String(req.params.id)
      await this.assertOrgAccess(req, organizationId)

      const limit = req.query.limit ? Number(req.query.limit) : 50
      const notifications = await this.notificationService.getOrganizationNotifications(organizationId, limit)
      res.json({ data: notifications })
    } catch (error: any) {
      const status = error.status ?? this.orgErrorStatus(error.message)
      res.status(status).json({ error: error.message })
    }
  }

  getShops = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = String(req.params.id)
      await this.assertOrgAccess(req, organizationId)

      const shops = await this.shopService.getAllShops(organizationId)
      res.json({ data: shops })
    } catch (error: any) {
      const status = error.status ?? this.orgErrorStatus(error.message)
      res.status(status).json({ error: error.message })
    }
  }

  getStock = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = String(req.params.id)
      await this.assertOrgAccess(req, organizationId)

      const stock = await this.inventoryService.getInventoryByOrganization(organizationId)
      res.json({ data: stock })
    } catch (error: any) {
      const status = error.status ?? this.orgErrorStatus(error.message)
      res.status(status).json({ error: error.message })
    }
  }

  getStockSummary = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const organizationId = String(req.params.id)
      await this.assertOrgAccess(req, organizationId)

      const threshold = req.query.lowStockThreshold !== undefined
        ? Number(req.query.lowStockThreshold)
        : 10

      const summary = await this.inventoryService.getStockSummaryByOrganization(organizationId, threshold)
      res.json({ data: summary })
    } catch (error: any) {
      const status = error.status ?? this.orgErrorStatus(error.message)
      res.status(status).json({ error: error.message })
    }
  }

  getStockTransactions = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const organizationId = String(req.params.id)
      await this.assertOrgAccess(req, organizationId)

      const limit = req.query.limit ? Number(req.query.limit) : 50
      const transactions = await this.inventoryService.getTransactionsByOrganization(organizationId, {
        ...(req.query.shopId ? { shopId: String(req.query.shopId) } : {}),
        ...(req.query.cursor ? { cursor: String(req.query.cursor) } : {}),
        take: limit
      })

      res.json({ data: transactions })
    } catch (error: any) {
      const status = error.status ?? this.orgErrorStatus(error.message)
      res.status(status).json({ error: error.message })
    }
  }
}
