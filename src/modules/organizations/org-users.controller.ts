import { PrismaClient } from '@prisma/client'
import { Response } from 'express'
import { body, validationResult } from 'express-validator'
import { AuthActor } from '../auth/permissions'
import { AuthenticatedRequest } from '../auth/types'
import { OrgUsersService } from './org-users.service'
import { CreateOrgUserInput, UpdateOrgUserInput } from './types'

export class OrgUsersController {
  constructor(
    private orgUsersService: OrgUsersService,
    private prisma: PrismaClient
  ) {}

  createValidation = [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').trim().notEmpty().isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('phoneNumber').trim().notEmpty().withMessage('phoneNumber is required')
      .isLength({ min: 9 }).withMessage('phoneNumber must be a valid phone number'),
    body('role').isIn(['STAFF', 'MANAGER']).withMessage('Role must be STAFF or MANAGER'),
    body('managerAccess').optional().isIn(['ONE_SHOP', 'ALL_SHOPS'])
      .withMessage('managerAccess must be ONE_SHOP or ALL_SHOPS'),
    body('shopId').optional().isUUID().withMessage('shopId must be a valid UUID')
  ]

  updateValidation = [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().trim().isEmail().withMessage('Email must be valid'),
    body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('phoneNumber').optional().trim().isLength({ min: 9 })
      .withMessage('phoneNumber must be a valid phone number'),
    body('role').optional().isIn(['STAFF', 'MANAGER']).withMessage('Role must be STAFF or MANAGER'),
    body('managerAccess').optional().isIn(['ONE_SHOP', 'ALL_SHOPS'])
      .withMessage('managerAccess must be ONE_SHOP or ALL_SHOPS'),
    body('shopId').optional().isUUID().withMessage('shopId must be a valid UUID')
  ]

  create = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const actor = await this.loadAuthActor(req)
      const user = await this.orgUsersService.createOrgUser(
        actor,
        String(req.params.id),
        req.body as CreateOrgUserInput
      )

      res.status(201).json({ data: user })
    } catch (error: any) {
      this.sendError(res, error)
    }
  }

  list = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const actor = await this.loadAuthActor(req)
      const users = await this.orgUsersService.listOrgUsers(actor, String(req.params.id))

      res.json({ data: users })
    } catch (error: any) {
      this.sendError(res, error)
    }
  }

  update = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const actor = await this.loadAuthActor(req)
      const user = await this.orgUsersService.updateOrgUser(
        actor,
        String(req.params.id),
        String(req.params.userId),
        req.body as UpdateOrgUserInput
      )

      res.json({ data: user })
    } catch (error: any) {
      this.sendError(res, error)
    }
  }

  deactivate = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const actor = await this.loadAuthActor(req)
      const user = await this.orgUsersService.deactivateOrgUser(
        actor,
        String(req.params.id),
        String(req.params.userId)
      )

      res.json({ data: user })
    } catch (error: any) {
      this.sendError(res, error)
    }
  }

  private async loadAuthActor(req: AuthenticatedRequest): Promise<AuthActor> {
    if (!req.user) {
      throw Object.assign(new Error('Authentication required'), { status: 401 })
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { managerAccess: true, organizationId: true }
    })
    const organizationId = req.user.organizationId ?? dbUser?.organizationId

    return {
      userId: req.user.userId,
      role: req.user.role,
      ...(organizationId !== undefined ? { organizationId } : {}),
      ...(dbUser?.managerAccess ? { managerAccess: dbUser.managerAccess } : {})
    }
  }

  private sendError(res: Response, error: any): void {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    const status = error?.status ?? this.errorStatus(message)
    res.status(status).json({ error: message })
  }

  private errorStatus(message: string): number {
    if (
      message.includes('Insufficient permissions') ||
      message.includes('Access denied')
    ) {
      return 403
    }
    if (message.includes('not found')) return 404
    return 400
  }
}
