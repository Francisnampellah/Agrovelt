import { Response } from 'express'
import { body, query, validationResult } from 'express-validator'
import { AuthenticatedRequest } from '../auth/types'
import { NotificationService } from '../notifications/notification.service'
import { ExpenseService } from './expense.service'

export class ExpenseController {
  constructor(
    private expenseService: ExpenseService,
    private notificationService: NotificationService
  ) {}

  createValidation = [
    body('shopId').isUUID().withMessage('Valid shop ID is required'),
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('category').optional().isString(),
    body('date').isISO8601().withMessage('Valid date is required')
  ]

  listValidation = [
    query('shopId').isUUID().withMessage('Valid shop ID is required')
  ]

  create = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const expense = await this.expenseService.createExpense({
        ...req.body,
        date: new Date(req.body.date),
        recordedBy: req.user.userId
      })

      const shop = await this.expenseService.getExpenseShop(expense.shopId)
      const notification = await this.notificationService.recordFromShopActivity(
        expense.shopId,
        this.notificationService.fromExpense({
          id: expense.id,
          shopId: expense.shopId,
          title: expense.title,
          amount: expense.amount,
          ...(shop ? { shop: { name: shop.name } } : {})
        })
      )

      res.status(201).json({ data: expense, notification })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  list = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const expenses = await this.expenseService.getExpensesByShop(String(req.query.shopId))
      res.json({ data: expenses })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }
}
