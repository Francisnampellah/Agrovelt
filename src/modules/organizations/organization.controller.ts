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
import { CashFlowService } from '../cashflow/cashflow.service'
import { assertOrganizationAccess } from './organization-access'
import { OrganizationService } from './organization.service'
import { CreateOrganizationRequest } from './types'
import { formatCollectorAuthResponse } from '../auth/collectorResponse'
import { assertShopInScope, resolveShopScope } from '../auth/shopScope'
import { loadAuthActor } from '../auth/assertActor'
import { canGenerateReports, canManageUsers } from '../auth/permissions'

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

  updateSettingsValidation = [
    body('defaultMarkupPercent')
      .optional({ nullable: true })
      .isFloat({ min: 0 })
      .withMessage('Default markup percent must be >= 0')
  ]

  // Shared by getSettings/updateSettings - the org's own OWNER can reach
  // both (not just platform admins), unlike GET/PUT /organizations/:id.
  private async assertSettingsAccess(req: AuthenticatedRequest, organizationId: string): Promise<void> {
    const actor = await loadAuthActor(this.prisma, req)
    if (!canManageUsers(actor)) {
      throw Object.assign(new Error('Insufficient permissions for organization settings'), { status: 403 })
    }
    if (actor.role === 'OWNER' && actor.organizationId !== organizationId) {
      throw Object.assign(new Error('Access denied to this organization'), { status: 403 })
    }
  }

  getSettings = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = String(req.params.id)
      await this.assertSettingsAccess(req, organizationId)

      const org = await this.organizationService.getOrganizationById(organizationId)
      res.json({ data: { defaultMarkupPercent: org.defaultMarkupPercent } })
    } catch (error: any) {
      const status = error.status ?? this.orgErrorStatus(error.message)
      res.status(status).json({ error: error.message })
    }
  }

  // Narrower than update - only ever writes settings fields, never
  // name/slug/email.
  updateSettings = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const organizationId = String(req.params.id)
      await this.assertSettingsAccess(req, organizationId)

      const org = await this.organizationService.updateOrganizationSettings(organizationId, req.body)
      res.json({ data: { defaultMarkupPercent: org.defaultMarkupPercent } })
    } catch (error: any) {
      const status = error.status ?? this.orgErrorStatus(error.message)
      res.status(status).json({ error: error.message })
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
    query('to').optional().isISO8601().withMessage('Valid to date is required'),
    query('shopIds').optional().isString(),
    // The "span >= 24h" / "starts within 3 months" guardrails belong to the
    // report-generation UX only, and are already enforced client-side in
    // ReportGeneratorDrawer.jsx before it ever calls this endpoint. This
    // endpoint also backs the Overview KPI cards, which legitimately query
    // much shorter ("today") and much longer ("year to date") ranges — so
    // only the future-date check, a real data-integrity concern, belongs
    // here.
    query('to').custom((value, { req }) => {
      if (!req.query?.from || !value) return true

      const to = new Date(String(value))
      const oneDayMs = 24 * 60 * 60 * 1000
      // Allow a day of slack past "now": the frontend defaults "to" to
      // today and sends end-of-day (23:59:59) with no timezone designator,
      // which JS parses as the caller's local time — so "today" in a UTC+3
      // browser (or ahead of the server's clock at all) legitimately lands
      // a few hours past the server's Date.now(). Without this, picking
      // "today" as the end date — the natural default — always fails.
      if (to.getTime() > Date.now() + oneDayMs) {
        throw new Error('Report range cannot extend into the future')
      }
      return true
    })
  ]

  private orgErrorStatus(message: string): number {
    if (message === 'Organization not found') return 404
    if (message.includes('Access denied') || message.includes('Insufficient permissions')) return 403
    return 400
  }

  private async assertOrgAccess(req: AuthenticatedRequest, organizationId: string) {
    if (!req.user) {
      throw Object.assign(new Error('Authentication required'), { status: 401 })
    }
    await assertOrganizationAccess(this.prisma, req.user.userId, req.user.role, organizationId)
  }

  private parseDateRange(req: AuthenticatedRequest) {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(0)
    const to = req.query.to ? new Date(String(req.query.to)) : new Date()
    return { from, to }
  }

  private parseShopIds(req: AuthenticatedRequest): string[] | undefined {
    const raw = req.query.shopIds
    if (!raw) return undefined
    return String(raw).split(',').map(id => id.trim()).filter(Boolean)
  }

  private async getReportShopIds(req: AuthenticatedRequest): Promise<string[] | undefined> {
    const actor = await loadAuthActor(this.prisma, req)
    const shopId = req.query.shopId ? String(req.query.shopId) : undefined
    if (!canGenerateReports(actor, { allShopsScope: !shopId })) {
      throw Object.assign(new Error('Insufficient permissions to generate reports'), { status: 403 })
    }
    if (!shopId) return undefined

    await assertShopInScope(this.prisma, actor, shopId)
    return [shopId]
  }

  getSales = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const organizationId = String(req.params.id)
      await assertOrganizationAccess(this.prisma, req.user.userId, req.user.role, organizationId)
      const shopIds = await this.getReportShopIds(req)

      const sales = await this.saleService.getSalesByOrganization(organizationId, shopIds)
      res.json({ data: sales })
    } catch (error: any) {
      const status = error.status ?? this.orgErrorStatus(error.message)
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
      const shopIds = await this.getReportShopIds(req)

      const expenses = await this.expenseService.getExpensesByOrganization(organizationId, shopIds)
      res.json({ data: expenses })
    } catch (error: any) {
      const status = error.status ?? this.orgErrorStatus(error.message)
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
      const shopIds = await this.getReportShopIds(req)

      const purchases = await this.purchaseService.getPurchasesByOrganization(organizationId, shopIds)
      res.json({ data: purchases })
    } catch (error: any) {
      const status = error.status ?? this.orgErrorStatus(error.message)
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
      if (req.user && (req.user.role === 'STAFF' || req.user.role === 'MANAGER')) {
        const scope = await resolveShopScope(this.prisma, req.user)
        if (!scope.allShops) {
          return res.json({ data: shops.filter(shop => scope.shopIds.includes(shop.id)) })
        }
      }

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
      const shopIds = await this.getReportShopIds(req)

      const stock = await this.inventoryService.getInventoryByOrganization(organizationId, shopIds)
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
      const shopIds = await this.getReportShopIds(req)

      const threshold = req.query.lowStockThreshold !== undefined
        ? Number(req.query.lowStockThreshold)
        : 10

      const summary = await this.inventoryService.getStockSummaryByOrganization(
        organizationId,
        threshold,
        shopIds
      )
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
      const shopIds = await this.getReportShopIds(req)

      const limit = req.query.limit ? Number(req.query.limit) : 50
      const transactions = await this.inventoryService.getTransactionsByOrganization(organizationId, {
        ...(req.query.shopId ? { shopId: String(req.query.shopId) } : {}),
        ...(shopIds ? { shopIds } : {}),
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
      const shopIds = this.parseShopIds(req)
      const [cashSummary, stockSummary] = await Promise.all([
        this.cashFlowService.getFinanceSummaryByOrganization(organizationId, from, to, shopIds),
        // Stock on hand is a live snapshot, not a historical figure, so it
        // isn't scoped to the date range — only to the shop selection.
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
      const { from, to } = this.parseDateRange(req)
      const shopIds = this.parseShopIds(req)
      const activity = await this.cashFlowService.getEntriesByOrganization(organizationId, {
        ...(req.query.from ? { from } : {}),
        ...(req.query.to ? { to } : {}),
        ...(shopIds ? { shopIds } : {}),
        take
      })
      res.json({ data: activity })
    } catch (error: any) {
      const status = error.status ?? this.orgErrorStatus(error.message)
      res.status(status).json({ error: error.message })
    }
  }

}
