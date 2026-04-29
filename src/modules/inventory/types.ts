import { InventoryTxnType } from '@prisma/client'

export interface UpdateInventoryRequest {
  shopId: string
  variantId: string
  quantity: number
  costPrice: number
  sellingPrice: number
}

export interface AdjustInventoryRequest {
  shopId: string
  variantId: string
  change: number
  type: InventoryTxnType
  referenceId?: string
}

export interface InventoryResponse {
  id: string
  shopId: string
  variantId: string
  quantity: number
  costPrice: number
  sellingPrice: number
  updatedAt: Date
}

export interface InventoryTransactionResponse {
  id: string
  shopId: string
  variantId: string
  type: InventoryTxnType
  quantity: number
  referenceId: string | null
  createdAt: Date
}
