import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { OrganizationService } from './organization.service'
import { CreateOrganizationRequest, UpdateOrganizationRequest } from './types'

export class OrganizationController {
  constructor(private organizationService: OrganizationService) {}

  createValidation = [
    body('name').trim().notEmpty().withMessage('Organization name is required').isLength({ min: 2, max: 100 })
  ]

  updateValidation = [
    body('name').optional().trim().isLength({ min: 2, max: 100 })
  ]

  create = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const data: CreateOrganizationRequest = req.body
      const org = await this.organizationService.createOrganization(data)
      res.status(201).json({ data: org })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  getAll = async (req: Request, res: Response) => {
    try {
      const orgs = await this.organizationService.getAllOrganizations()
      res.json({ data: orgs })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const org = await this.organizationService.getOrganizationById(String(req.params.id))
      res.json({ data: org })
    } catch (error: any) {
      res.status(error.message === 'Organization not found' ? 404 : 400).json({ error: error.message })
    }
  }

  update = async (req: Request, res: Response) => {
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
