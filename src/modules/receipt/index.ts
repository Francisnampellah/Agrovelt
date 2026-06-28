import { PrismaClient } from '@prisma/client'
import { ReceiptService } from './receipt.service'
import { ReceiptController } from './receipt.controller'

export function createReceiptModule(prisma: PrismaClient) {
  const receiptService = new ReceiptService(prisma)
  const receiptController = new ReceiptController(receiptService, prisma)

  return { receiptService, receiptController }
}

export { ReceiptService, ReceiptController }
export * from './types'
