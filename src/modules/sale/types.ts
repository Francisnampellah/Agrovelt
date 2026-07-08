import { PaymentMethod } from '@prisma/client'

export interface CreateSaleItemRequest {
  inventoryId?: string
  variantId: string
  quantity: number
  price?: number
  /** Preferred batch field */
  batchNumber?: string
  /** Legacy/mobile alias accepted for batchNumber */
  batch?: string
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
