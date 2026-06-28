import { Response } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { PrismaClient } from '@prisma/client'
import { AuthenticatedRequest } from '../auth/types'
import { assertOrganizationAccess } from '../organizations/organization-access'
import { NotificationService } from './notification.service'
import { NotificationType } from './types'

export class NotificationController {
  constructor(
    private notificationService: NotificationService,
    private prisma: PrismaClient
  ) {}

  listValidation = [
    query('organizationId').isUUID().withMessage('Valid organization ID is required'),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    query('type').optional().isIn(['SALE', 'PURCHASE', 'EXPENSE', 'SALE_REFUND', 'SYSTEM'])
  ]

  unreadCountValidation = [
    query('organizationId').isUUID().withMessage('Valid organization ID is required')
  ]

  markAllReadValidation = [
    body('organizationId').isUUID().withMessage('Valid organization ID is required')
  ]

  idParamValidation = [
    param('notificationId').isUUID().withMessage('Valid notification ID is required')
  ]

  private async assertOrg(req: AuthenticatedRequest, organizationId: string) {
    if (!req.user) {
      throw Object.assign(new Error('Authentication required'), { status: 401 })
    }
    await assertOrganizationAccess(this.prisma, req.user.userId, req.user.role, organizationId)
  }

  private orgErrorStatus(message: string, status?: number): number {
    if (status) return status
    if (message === 'Organization not found') return 404
    if (message === 'Access denied to this organization') return 403
    if (message === 'Notification not found') return 404
    return 400
  }

  list = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const organizationId = String(req.query.organizationId)
      await this.assertOrg(req, organizationId)

      const limit = req.query.limit ? Number(req.query.limit) : 50
      const unreadOnly = req.query.unreadOnly === 'true'
      const type = req.query.type ? String(req.query.type) as NotificationType : undefined

      const notifications = await this.notificationService.getOrganizationNotifications(
        organizationId,
        limit,
        { unreadOnly, ...(type ? { type } : {}) }
      )

      res.json({ data: notifications })
    } catch (error: any) {
      res.status(this.orgErrorStatus(error.message, error.status)).json({ error: error.message })
    }
  }

  unreadCount = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const organizationId = String(req.query.organizationId)
      await this.assertOrg(req, organizationId)

      const count = await this.notificationService.getUnreadCount(organizationId)
      res.json({ data: { count } })
    } catch (error: any) {
      res.status(this.orgErrorStatus(error.message, error.status)).json({ error: error.message })
    }
  }

  getById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const row = await this.prisma.notification.findUnique({
        where: { id: String(req.params.notificationId) }
      })

      if (!row) {
        return res.status(404).json({ error: 'Notification not found' })
      }

      await this.assertOrg(req, row.organizationId)

      res.json({ data: this.notificationService.toItem(row) })
    } catch (error: any) {
      res.status(this.orgErrorStatus(error.message, error.status)).json({ error: error.message })
    }
  }

  markAsRead = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const row = await this.prisma.notification.findUnique({
        where: { id: String(req.params.notificationId) }
      })

      if (!row) {
        return res.status(404).json({ error: 'Notification not found' })
      }

      await this.assertOrg(req, row.organizationId)

      const notification = await this.notificationService.markAsRead(
        row.id,
        row.organizationId
      )

      res.json({ data: notification })
    } catch (error: any) {
      res.status(this.orgErrorStatus(error.message, error.status)).json({ error: error.message })
    }
  }

  markAllAsRead = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const organizationId = req.body.organizationId as string
      await this.assertOrg(req, organizationId)

      const result = await this.notificationService.markAllAsRead(organizationId)
      res.json({ message: 'All notifications marked as read', data: result })
    } catch (error: any) {
      res.status(this.orgErrorStatus(error.message, error.status)).json({ error: error.message })
    }
  }

  remove = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const row = await this.prisma.notification.findUnique({
        where: { id: String(req.params.notificationId) }
      })

      if (!row) {
        return res.status(404).json({ error: 'Notification not found' })
      }

      await this.assertOrg(req, row.organizationId)

      await this.notificationService.deleteNotification(row.id, row.organizationId)
      res.json({ message: 'Notification deleted' })
    } catch (error: any) {
      res.status(this.orgErrorStatus(error.message, error.status)).json({ error: error.message })
    }
  }
}
