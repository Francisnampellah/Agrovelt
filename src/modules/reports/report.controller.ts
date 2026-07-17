import { Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { body, param, query, validationResult } from 'express-validator'
import { AuthenticatedRequest } from '../auth/types'
import { loadAuthActor } from '../auth/assertActor'
import { assertOrganizationAccess } from '../organizations/organization-access'
import { BusinessReportService } from './report.service'
import { ReportApiError } from './report.errors'
import { REPORT_GROUP_BY, REPORT_PAYMENT_METHODS, REPORT_TRANSACTION_TYPES } from './types'

export class BusinessReportController {
  constructor(
    private reportService: BusinessReportService,
    private prisma: PrismaClient
  ) {}

  generateValidation = [
    body('from').isISO8601().withMessage('from must be ISO-8601'),
    body('to').isISO8601().withMessage('to must be ISO-8601'),
    body('shopIds').optional().isArray(),
    body('shopIds.*').optional().isUUID(),
    body('timezone').optional().isString(),
    body('groupBy').optional().isIn([...REPORT_GROUP_BY]),
    body('currency').optional().isString(),
    body('include').optional().isObject(),
    body('filters').optional().isObject(),
    body('filters.paymentMethods.*').optional().isIn([...REPORT_PAYMENT_METHODS]),
    body('filters.transactionTypes.*').optional().isIn([...REPORT_TRANSACTION_TYPES]),
    body('limits').optional().isObject(),
    body('sort').optional().isObject()
  ]

  listValidation = [
    query('limit').optional().isInt({ min: 1, max: 100 })
  ]

  getValidation = [
    param('reportId').isUUID().withMessage('reportId must be a UUID')
  ]

  generate = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'REPORT_VALIDATION_FAILED',
          details: { errors: errors.array() }
        })
      }

      if (!req.user) return res.status(401).json({ error: 'Authentication required' })

      const organizationId = String(req.params.id)
      await assertOrganizationAccess(this.prisma, req.user.userId, req.user.role, organizationId)
      const actor = await loadAuthActor(this.prisma, req)
      const report = await this.reportService.generate(actor, organizationId, req.body)
      return res.status(201).json({ data: report })
    } catch (error: any) {
      return this.sendError(res, error)
    }
  }

  list = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'REPORT_VALIDATION_FAILED',
          details: { errors: errors.array() }
        })
      }

      if (!req.user) return res.status(401).json({ error: 'Authentication required' })

      const organizationId = String(req.params.id)
      await assertOrganizationAccess(this.prisma, req.user.userId, req.user.role, organizationId)
      const actor = await loadAuthActor(this.prisma, req)
      const limit = req.query.limit ? Number(req.query.limit) : 20
      const reports = await this.reportService.list(actor, organizationId, limit)
      return res.json({ data: reports })
    } catch (error: any) {
      return this.sendError(res, error)
    }
  }

  getById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'REPORT_VALIDATION_FAILED',
          details: { errors: errors.array() }
        })
      }

      if (!req.user) return res.status(401).json({ error: 'Authentication required' })

      const organizationId = String(req.params.id)
      const reportId = String(req.params.reportId)
      await assertOrganizationAccess(this.prisma, req.user.userId, req.user.role, organizationId)
      const actor = await loadAuthActor(this.prisma, req)
      const report = await this.reportService.getById(actor, organizationId, reportId)
      return res.json({ data: report })
    } catch (error: any) {
      return this.sendError(res, error)
    }
  }

  private sendError(res: Response, error: any) {
    if (error instanceof ReportApiError) {
      return res.status(error.status).json(error.toJSON())
    }
    const message = error?.message ? String(error.message) : 'Unexpected error'
    if (message === 'Organization not found') {
      return res.status(404).json({ error: message, code: 'ORG_NOT_FOUND', details: {} })
    }
    if (message.includes('Access denied') || message.includes('Insufficient permissions')) {
      return res.status(403).json({ error: message, code: 'REPORT_FORBIDDEN', details: {} })
    }
    return res.status(400).json({ error: message, code: 'REPORT_ERROR', details: {} })
  }
}
