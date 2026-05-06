import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { ShopService } from './shop.service'
import { CreateShopRequest, UpdateShopRequest } from './types'
import { AuthenticatedRequest } from '../auth/types'

export class ShopController {
  constructor(private shopService: ShopService) {}

  // Validation rules
  createShopValidation = [
    body('name').trim().notEmpty().withMessage('Shop name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('location').optional().trim().isLength({ max: 255 }).withMessage('Location too long'),
    body('ownerId').notEmpty().isUUID().withMessage('Valid owner ID is required'),
    body('organizationId').notEmpty().isUUID().withMessage('Valid organization ID is required'),
    body('parentId').optional().isUUID().withMessage('Valid parent shop ID is required')
  ]

  updateShopValidation = [
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('location').optional().trim().isLength({ max: 255 }).withMessage('Location too long')
  ]

  create = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const data: CreateShopRequest = req.body
      const shop = await this.shopService.createShop(data)

      res.status(201).json({
        message: 'Shop created successfully',
        data: shop
      })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  getAll = async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest
      const user = authReq.user
      
      // If NOT SUPER_ADMIN, we might want to filter by organizationId
      // However, we need to know the organizationId of the user.
      // Let's assume for now that if they are NOT SUPER_ADMIN, 
      // they should only see shops from their organization.
      
      let organizationId: string | undefined
      
      if (user && user.role !== 'SUPER_ADMIN') {
        const fullUser = await (this.shopService as any).prisma.user.findUnique({
          where: { id: user.userId },
          select: { organizationId: true }
        })
        organizationId = fullUser?.organizationId
      }

      const shops = await this.shopService.getAllShops(organizationId)
      res.json({ data: shops })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id)
      const shop = await this.shopService.getShopById(id)
      res.json({ data: shop })
    } catch (error: any) {
      const statusCode = error.message === 'Shop not found' ? 404 : 400
      res.status(statusCode).json({ error: error.message })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const id = String(req.params.id)
      const data: UpdateShopRequest = req.body
      const shop = await this.shopService.updateShop(id, data)

      res.json({
        message: 'Shop updated successfully',
        data: shop
      })
    } catch (error: any) {
      const statusCode = error.message === 'Shop not found' ? 404 : 400
      res.status(statusCode).json({ error: error.message })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id)
      await this.shopService.deleteShop(id)
      res.json({ message: 'Shop deleted successfully' })
    } catch (error: any) {
      const statusCode = error.message === 'Shop not found' ? 404 : 400
      res.status(statusCode).json({ error: error.message })
    }
  }

  getByOwner = async (req: Request, res: Response) => {
    try {
      const ownerId = String(req.params.ownerId)
      const shops = await this.shopService.getShopsByOwner(ownerId)
      res.json({ data: shops })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }
}
