import { Response } from 'express'
import { body, validationResult } from 'express-validator'
import { AuthenticatedRequest } from '../auth/types'
import { AuthService } from '../auth/auth.service'
import { OrganizationService } from './organization.service'
import { CreateOrganizationRequest, UpdateOrganizationRequest } from './types'

export class OrganizationController {
  constructor(
    private organizationService: OrganizationService,
    private authService: AuthService
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

      res.status(201).json({
        message: 'Organization created and linked to your account',
        data: {
          ...result,
          token: session.token,
          refreshToken: session.refreshToken
        }
      })
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
}
