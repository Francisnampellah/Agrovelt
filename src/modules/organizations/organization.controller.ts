import { Response } from 'express'
import { PrismaClient, Role } from '@prisma/client'
import { body, query, validationResult } from 'express-validator'
import { AuthenticatedRequest } from '../auth/types'
import { AuthService } from '../auth/auth.service'
import { ExpenseService } from '../expense/expense.service'
import { NotificationService } from '../notifications/notification.service'
import { PurchaseService } from '../purchase/purchase.service'
import { SaleService } from '../sale/sale.service'
import { InventoryService } from '../inventory/inventory.service'
import { ShopService } from '../shops/shop.service'
import { CashFlowService } from '../cashflow/cashflow.service'
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
    private shopService: ShopService,
    private cashFlowService: CashFlowService
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

  financeQueryValidation = [
    query('from').optional().isISO8601().withMessage('Valid from date is required'),
    query('to').optional().isISO8601().withMessage('Valid to date is required')
  ]

  createOrgUserValidation = [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email format'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['ADMIN', 'STAFF']).withMessage('Role must be ADMIN or STAFF')
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

  private assertOrgManager(req: AuthenticatedRequest) {
    const role = req.user?.role
    if (role !== Role.OWNER && role !== Role.ADMIN && role !== Role.SUPER_ADMIN) {
      throw Object.assign(new Error('Only owners and admins can manage team members'), { status: 403 })
    }
  }

  private parseDateRange(req: AuthenticatedRequest) {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(0)
    const to = req.query.to ? new Date(String(req.query.to)) : new Date()
    return { from, to }
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

  getFinanceSummary = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const organizationId = String(req.params.id)
      await this.assertOrgAccess(req, organizationId)

      const { from, to } = this.parseDateRange(req)
      const [cashSummary, stockSummary] = await Promise.all([
        this.cashFlowService.getFinanceSummaryByOrganization(organizationId, from, to),
        this.inventoryService.getStockSummaryByOrganization(organizationId)
      ])

      res.json({
        data: {
          ...cashSummary,
          stockUnitsOnHand: stockSummary.totalUnits,
          lowStockCount: stockSummary.lowStockCount
        }
      })
    } catch (error: any) {
      const status = error.status ?? this.orgErrorStatus(error.message)
      res.status(status).json({ error: error.message })
    }
  }

  getFinanceActivity = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const organizationId = String(req.params.id)
      await this.assertOrgAccess(req, organizationId)

      const take = req.query.take ? Number(req.query.take) : 20
      const activity = await this.cashFlowService.getEntriesByOrganization(organizationId, { take })
      res.json({ data: activity })
    } catch (error: any) {
      const status = error.status ?? this.orgErrorStatus(error.message)
      res.status(status).json({ error: error.message })
    }
  }

  getOrgUsers = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = String(req.params.id)
      await this.assertOrgAccess(req, organizationId)

      const users = await this.authService.getOrganizationUsers(organizationId)
      res.json({ data: users })
    } catch (error: any) {
      const status = error.status ?? this.orgErrorStatus(error.message)
      res.status(status).json({ error: error.message })
    }
  }

  createOrgUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const organizationId = String(req.params.id)
      await this.assertOrgAccess(req, organizationId)
      this.assertOrgManager(req)

      const result = await this.authService.createOrganizationUser(organizationId, req.body)
      res.status(201).json({ message: 'User created successfully', user: result.user })
    } catch (error: any) {
      const status = error.status ?? this.orgErrorStatus(error.message)
      res.status(status).json({ error: error.message })
    }
  }

  deactivateOrgUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const organizationId = String(req.params.id)
      const userId = String(req.params.userId)
      await this.assertOrgAccess(req, organizationId)
      this.assertOrgManager(req)

      const user = await this.authService.deactivateOrganizationUser(organizationId, userId, req.user.userId)
      res.json({ message: 'User deactivated successfully', user })
    } catch (error: any) {
      const status = error.status ?? this.orgErrorStatus(error.message)
      res.status(status).json({ error: error.message })
    }
  }
}
