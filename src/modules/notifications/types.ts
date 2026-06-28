export type NotificationType = 'SALE' | 'PURCHASE' | 'EXPENSE' | 'SALE_REFUND'

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  message: string
  referenceId: string
  shopId: string
  shopName: string
  amount: number
  createdAt: Date
}
