import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthMiddleware, AuthService } from '../modules/auth'
import { createReceiptModule } from '../modules/receipt'

export function createReceiptRoutes(prisma: PrismaClient) {
  const router = Router()
  const authMiddleware = new AuthMiddleware(new AuthService(prisma))
  const { receiptController } = createReceiptModule(prisma)

  router.get(
    '/receipts',
    authMiddleware.authenticate,
    receiptController.listValidation,
    receiptController.listByShop
  )

  router.get(
    '/receipts/by-number/:receiptNumber',
    authMiddleware.authenticate,
    receiptController.getByNumber
  )

  router.get(
    '/receipts/:receiptId',
    authMiddleware.authenticate,
    receiptController.getById
  )

  router.post(
    '/receipts/:receiptId/print',
    authMiddleware.authenticate,
    receiptController.markPrinted
  )

  router.post(
    '/receipts/:receiptId/void',
    authMiddleware.authenticate,
    receiptController.voidReceipt
  )

  router.get(
    '/organizations/:organizationId/receipts',
    authMiddleware.authenticate,
    receiptController.orgListValidation,
    receiptController.listByOrganization
  )

  return router
}
