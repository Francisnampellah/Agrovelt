import { Router, Response } from 'express'
import { PrismaClient, CashFlowCategory } from '@prisma/client'
import { body, query, validationResult } from 'express-validator'
import { AuthMiddleware, AuthService } from '../modules/auth'
import { loadAuthActor } from '../modules/auth/assertActor'
import { canAddOrgFunding, canViewShopFinance } from '../modules/auth/permissions'
import { assertShopInScope } from '../modules/auth/shopScope'
import { AuthenticatedRequest } from '../modules/auth/types'
import { CashFlowService } from '../modules/cashflow/cashflow.service'

function parseDate(value: unknown, fallback: Date) {
  if (!value) return fallback
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

export function createCashFlowRoutes(prisma: PrismaClient) {
  const router = Router()
  const authMiddleware = new AuthMiddleware(new AuthService(prisma))
  const cashFlowService = new CashFlowService(prisma)

  router.post(
    '/cashflow/funding',
    authMiddleware.authenticate,
    [
      body('shopId').isUUID().withMessage('Valid shop ID is required'),
      body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
      body('note').optional().isString()
    ],
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

        const actor = await loadAuthActor(prisma, req)
        if (!canAddOrgFunding(actor)) {
          return res.status(403).json({ error: 'Insufficient permissions to record organization funding' })
        }
        await assertShopInScope(prisma, actor, String(req.body.shopId))

        const entry = await cashFlowService.recordFunding(
          String(req.body.shopId),
          Number(req.body.amount),
          actor.userId,
          req.body.note
        )
        res.status(201).json({ data: entry })
      } catch (error: any) {
        const status = error.message?.includes('Access denied') ? 403 : 400
        res.status(status).json({ error: error.message })
      }
    }
  )

  router.get(
    '/cashflow/summary',
    authMiddleware.authenticate,
    [
      query('shopId').isUUID().withMessage('Valid shop ID is required'),
      query('from').optional().isISO8601().withMessage('Valid from date is required'),
      query('to').optional().isISO8601().withMessage('Valid to date is required')
    ],
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

        const actor = await loadAuthActor(prisma, req)
        await assertShopInScope(prisma, actor, String(req.query.shopId))
        if (!canViewShopFinance(actor, true)) {
          return res.status(403).json({ error: 'Insufficient permissions to view shop finance' })
        }

        const from = parseDate(req.query.from, new Date(0))
        const to = parseDate(req.query.to, new Date())
        const summary = await cashFlowService.getSummary(String(req.query.shopId), from, to)

        res.json({ data: summary })
      } catch (error: any) {
        const status = error.message?.includes('Access denied') ? 403 : 400
        res.status(status).json({ error: error.message })
      }
    }
  )

  router.get(
    '/cashflow/entries',
    authMiddleware.authenticate,
    [
      query('shopId').isUUID().withMessage('Valid shop ID is required'),
      query('direction').optional().isIn(['IN', 'OUT']).withMessage('Direction must be IN or OUT'),
      query('category').optional().isString(),
      query('from').optional().isISO8601().withMessage('Valid from date is required'),
      query('to').optional().isISO8601().withMessage('Valid to date is required'),
      query('take').optional().isInt({ min: 1, max: 100 }).withMessage('Take must be between 1 and 100')
    ],
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

        const actor = await loadAuthActor(prisma, req)
        await assertShopInScope(prisma, actor, String(req.query.shopId))
        if (!canViewShopFinance(actor, true)) {
          return res.status(403).json({ error: 'Insufficient permissions to view shop finance' })
        }

        const filters: Parameters<CashFlowService['getEntries']>[1] = {}
        if (req.query.direction) filters.direction = req.query.direction as 'IN' | 'OUT'
        if (req.query.category) filters.category = req.query.category as CashFlowCategory
        if (req.query.from) filters.from = new Date(String(req.query.from))
        if (req.query.to) filters.to = new Date(String(req.query.to))
        if (req.query.cursor) filters.cursor = String(req.query.cursor)
        if (req.query.take) filters.take = Number(req.query.take)

        const entries = await cashFlowService.getEntries(String(req.query.shopId), filters)

        res.json({ data: entries })
      } catch (error: any) {
        const status = error.message?.includes('Access denied') ? 403 : 400
        res.status(status).json({ error: error.message })
      }
    }
  )

  return router
}
