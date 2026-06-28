import { ReceiptStatus } from '@prisma/client'

export interface ReceiptListFilters {
  shopId?: string
  status?: ReceiptStatus
  from?: Date
  to?: Date
}

export interface CreateReceiptInput {
  saleId: string
  shopId: string
  organizationId: string
  issuedBy: string
  notes?: string
}
