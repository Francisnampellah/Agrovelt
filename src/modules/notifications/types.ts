export type NotificationType = 'SALE' | 'PURCHASE' | 'EXPENSE' | 'SALE_REFUND' | 'SYSTEM'

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  message: string
  referenceId: string
  shopId: string
  shopName: string
  amount: number
  isRead: boolean
  readAt: Date | null
  createdAt: Date
}

export interface RecordNotificationInput {
  organizationId: string
  type: NotificationType
  title: string
  message: string
  referenceId?: string
  shopId?: string
  shopName?: string
  amount?: number
  userId?: string
}
