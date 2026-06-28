import { SaleStatus } from '@prisma/client'
import { SaleService } from '../sale/sale.service'
import { ExpenseService } from '../expense/expense.service'
import { PurchaseService } from '../purchase/purchase.service'
import { NotificationItem, NotificationType } from './types'

export class NotificationService {
  constructor(
    private saleService: SaleService,
    private expenseService: ExpenseService,
    private purchaseService: PurchaseService
  ) {}

  fromSale(sale: {
    id: string
    shopId: string
    total: number
    status: SaleStatus
    createdAt: Date
    shop?: { name: string }
  }): NotificationItem {
    const isRefund = sale.status === SaleStatus.REFUNDED
    const type: NotificationType = isRefund ? 'SALE_REFUND' : 'SALE'

    return {
      id: `sale-${sale.id}`,
      type,
      title: isRefund ? 'Sale refunded' : 'New sale recorded',
      message: isRefund
        ? `Sale #${sale.id.slice(0, 8)} was refunded`
        : `Sale #${sale.id.slice(0, 8)} completed`,
      referenceId: sale.id,
      shopId: sale.shopId,
      shopName: sale.shop?.name ?? 'Unknown shop',
      amount: sale.total,
      createdAt: sale.createdAt
    }
  }

  fromPurchase(purchase: {
    id: string
    shopId: string
    totalAmount: number
    createdAt: Date
    shop?: { name: string }
  }): NotificationItem {
    return {
      id: `purchase-${purchase.id}`,
      type: 'PURCHASE',
      title: 'Stock purchase recorded',
      message: `Purchase #${purchase.id.slice(0, 8)} received`,
      referenceId: purchase.id,
      shopId: purchase.shopId,
      shopName: purchase.shop?.name ?? 'Unknown shop',
      amount: purchase.totalAmount,
      createdAt: purchase.createdAt
    }
  }

  fromExpense(expense: {
    id: string
    shopId: string
    title: string
    amount: number
    date: Date
    shop?: { name: string }
  }): NotificationItem {
    return {
      id: `expense-${expense.id}`,
      type: 'EXPENSE',
      title: 'Expense recorded',
      message: expense.title,
      referenceId: expense.id,
      shopId: expense.shopId,
      shopName: expense.shop?.name ?? 'Unknown shop',
      amount: expense.amount,
      createdAt: expense.date
    }
  }

  async getOrganizationNotifications(organizationId: string, limit = 50): Promise<NotificationItem[]> {
    const [sales, purchases, expenses] = await Promise.all([
      this.saleService.getSalesByOrganization(organizationId),
      this.purchaseService.getPurchasesByOrganization(organizationId),
      this.expenseService.getExpensesByOrganization(organizationId)
    ])

    const notifications: NotificationItem[] = [
      ...sales.map(sale => this.fromSale(sale)),
      ...purchases.map(purchase => this.fromPurchase(purchase)),
      ...expenses.map(expense => this.fromExpense(expense))
    ]

    return notifications
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
  }
}
