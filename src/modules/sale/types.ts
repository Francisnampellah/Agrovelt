import { PaymentMethod } from '@prisma/client'

export interface CreateSaleItemRequest {
  variantId: string
  quantity: number
  price?: number
  batchNumber?: string
}

export interface CreateSaleRequest {
  shopId: string
  createdBy: string
  items: CreateSaleItemRequest[]
  paymentMethod: PaymentMethod
  discount?: number
  tax?: number
  total?: number
}

export interface RefundSaleRequest {
  refundedBy: string
}
