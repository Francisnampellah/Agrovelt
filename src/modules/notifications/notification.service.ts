import { NotificationType as PrismaNotificationType, SaleStatus } from '@prisma/client'
import { PrismaClient } from '@prisma/client'
import { NotificationItem, NotificationType, RecordNotificationInput } from './types'

export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  toItem(notification: {
    id: string
    type: PrismaNotificationType
    title: string
    message: string
    referenceId: string | null
    shopId: string | null
    shopName: string | null
    amount: number | null
    isRead: boolean
    readAt: Date | null
    createdAt: Date
  }): NotificationItem {
    return {
      id: notification.id,
      type: notification.type as NotificationType,
      title: notification.title,
      message: notification.message,
      referenceId: notification.referenceId ?? '',
      shopId: notification.shopId ?? '',
      shopName: notification.shopName ?? 'Unknown shop',
      amount: notification.amount ?? 0,
      isRead: notification.isRead,
      readAt: notification.readAt,
      createdAt: notification.createdAt
    }
  }

  fromSale(sale: {
    id: string
    shopId: string
    total: number
    status: SaleStatus
    createdAt: Date
    shop?: { name: string }
  }): Omit<RecordNotificationInput, 'organizationId'> {
    const isRefund = sale.status === SaleStatus.REFUNDED
    const type: NotificationType = isRefund ? 'SALE_REFUND' : 'SALE'

    return {
      type,
      title: isRefund ? 'Sale refunded' : 'New sale recorded',
      message: isRefund
        ? `Sale #${sale.id.slice(0, 8)} was refunded`
        : `Sale #${sale.id.slice(0, 8)} completed`,
      referenceId: sale.id,
      shopId: sale.shopId,
      shopName: sale.shop?.name ?? 'Unknown shop',
      amount: sale.total
    }
  }

  fromPurchase(purchase: {
    id: string
    shopId: string
    totalAmount: number
    createdAt: Date
    shop?: { name: string }
  }): Omit<RecordNotificationInput, 'organizationId'> {
    return {
      type: 'PURCHASE',
      title: 'Stock purchase recorded',
      message: `Purchase #${purchase.id.slice(0, 8)} received`,
      referenceId: purchase.id,
      shopId: purchase.shopId,
      shopName: purchase.shop?.name ?? 'Unknown shop',
      amount: purchase.totalAmount
    }
  }

  fromExpense(expense: {
    id: string
    shopId: string
    title: string
    amount: number
    shop?: { name: string }
  }): Omit<RecordNotificationInput, 'organizationId'> {
    return {
      type: 'EXPENSE',
      title: 'Expense recorded',
      message: expense.title,
      referenceId: expense.id,
      shopId: expense.shopId,
      shopName: expense.shop?.name ?? 'Unknown shop',
      amount: expense.amount
    }
  }

  async recordNotification(input: RecordNotificationInput): Promise<NotificationItem> {
    const notification = await this.prisma.notification.create({
      data: {
        organizationId: input.organizationId,
        type: input.type,
        title: input.title,
        message: input.message,
        ...(input.referenceId !== undefined ? { referenceId: input.referenceId } : {}),
        ...(input.shopId !== undefined ? { shopId: input.shopId } : {}),
        ...(input.shopName !== undefined ? { shopName: input.shopName } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.userId !== undefined ? { userId: input.userId } : {})
      }
    })

    return this.toItem(notification)
  }

  async recordFromShopActivity(
    shopId: string,
    payload: Omit<RecordNotificationInput, 'organizationId'>
  ): Promise<NotificationItem> {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { organizationId: true }
    })

    if (!shop) {
      throw new Error(`Shop ${shopId} not found`)
    }

    return this.recordNotification({
      ...payload,
      organizationId: shop.organizationId
    })
  }

  async getOrganizationNotifications(
    organizationId: string,
    limit = 50,
    filters: { unreadOnly?: boolean; type?: NotificationType } = {}
  ): Promise<NotificationItem[]> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        organizationId,
        ...(filters.unreadOnly ? { isRead: false } : {}),
        ...(filters.type ? { type: filters.type } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return notifications.map(n => this.toItem(n))
  }

  async getNotificationById(notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId }
    })

    if (!notification) {
      throw new Error('Notification not found')
    }

    return this.toItem(notification)
  }

  async getUnreadCount(organizationId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { organizationId, isRead: false }
    })
  }

  async markAsRead(notificationId: string, organizationId: string): Promise<NotificationItem> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, organizationId }
    })

    if (!notification) {
      throw new Error('Notification not found')
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() }
    })

    return this.toItem(updated)
  }

  async markAllAsRead(organizationId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { organizationId, isRead: false },
      data: { isRead: true, readAt: new Date() }
    })

    return { updated: result.count }
  }

  async deleteNotification(notificationId: string, organizationId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, organizationId }
    })

    if (!notification) {
      throw new Error('Notification not found')
    }

    await this.prisma.notification.delete({ where: { id: notificationId } })
  }
}
