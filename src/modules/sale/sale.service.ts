import { Prisma, PrismaClient, SaleStatus } from '@prisma/client'
import { InventoryService } from '../inventory/inventory.service'
import { CashFlowService } from '../cashflow/cashflow.service'
import { PricingService } from '../pricing/pricing.service'
import { ReceiptService } from '../receipt/receipt.service'
import { CreateSaleRequest } from './types'

const MAX_SALE_CREATE_RETRIES = 3

interface PrismaKnownRequestErrorLike {
  code?: string
  meta?: {
    target?: unknown
  }
}

export class SaleCreationConflictError extends Error {
  readonly statusCode = 409

  constructor(message: string) {
    super(message)
    this.name = 'SaleCreationConflictError'
  }
}

export class SaleService {
  constructor(
    private prisma: PrismaClient,
    private inventoryService: InventoryService,
    private cashFlowService: CashFlowService,
    private pricingService: PricingService,
    private receiptService: ReceiptService
  ) {}

  private shouldRetrySaleCreation(error: unknown): boolean {
    const prismaError = error as PrismaKnownRequestErrorLike

    if (prismaError?.code === 'P2034') {
      return true
    }

    return (
      prismaError?.code === 'P2002' &&
      Array.isArray(prismaError.meta?.target) &&
      prismaError.meta.target.includes('receiptNumber')
    )
  }

  async createSale(data: CreateSaleRequest) {
    const variantIds = data.items.map(i => i.variantId)
    await this.inventoryService.assertSameOrg(data.shopId, variantIds)

    for (let attempt = 1; attempt <= MAX_SALE_CREATE_RETRIES; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          let subtotal = 0
          const resolvedItems: Array<{
            inventoryId?: string
            variantId: string
            quantity: number
            price: number
            batchNumber?: string
          }> = []

          for (const item of data.items) {
            let price = item.price
            if (price === undefined) {
              price = await this.pricingService.resolveSellingPrice(data.shopId, item.variantId, item.inventoryId)
            } else {
              await this.pricingService.validateSalePrice(data.shopId, item.variantId, price)
            }

            // Preferred: inventoryId targets the exact stock row.
            // Legacy: variantId + batch/batchNumber (defaults to DEFAULT).
            // Accept either style, including payloads that send inventoryId together with variantId/batch.
            const providedBatch = item.batchNumber ?? item.batch
            subtotal += item.quantity * price
            resolvedItems.push({
              ...(item.inventoryId ? { inventoryId: item.inventoryId } : {}),
              variantId: item.variantId,
              quantity: item.quantity,
              price,
              ...(providedBatch !== undefined
                ? { batchNumber: providedBatch }
                : item.inventoryId
                  ? {}
                  : { batchNumber: 'DEFAULT' })
            })
          }

          const discount = data.discount ?? 0
          const tax = data.tax ?? 0
          const total = data.total ?? (subtotal - discount + tax)

          const sale = await tx.sale.create({
            data: {
              shopId: data.shopId,
              subtotal,
              discount,
              tax,
              total,
              status: SaleStatus.COMPLETED,
              createdBy: data.createdBy
            }
          })

          for (const item of resolvedItems) {
            const depletedStock = await this.inventoryService.deductSaleStock({
              shopId: data.shopId,
              ...(item.inventoryId ? { inventoryId: item.inventoryId } : {}),
              variantId: item.variantId,
              ...(item.batchNumber !== undefined ? { batchNumber: item.batchNumber } : {}),
              quantity: item.quantity,
              saleId: sale.id
            }, tx)

            await tx.saleItem.create({
              data: {
                saleId: sale.id,
                inventoryId: depletedStock.inventoryId,
                variantId: item.variantId,
                batchNumber: depletedStock.batchNumber,
                quantity: item.quantity,
                price: item.price
              }
            })
          }

          await tx.payment.create({
            data: {
              saleId: sale.id,
              amount: total,
              method: data.paymentMethod
            }
          })

          await this.cashFlowService.record(tx, {
            shopId: data.shopId,
            direction: 'IN',
            category: 'SALE',
            amount: total,
            referenceId: sale.id,
            note: `Sale #${sale.id}`,
            recordedBy: data.createdBy
          })

          const shop = await tx.shop.findUnique({
            where: { id: data.shopId },
            select: { organizationId: true }
          })

          if (!shop) {
            throw new Error(`Shop ${data.shopId} not found`)
          }

          await this.receiptService.createForSale({
            saleId: sale.id,
            shopId: data.shopId,
            organizationId: shop.organizationId,
            issuedBy: data.createdBy
          }, tx)

          return tx.sale.findUnique({
            where: { id: sale.id },
            include: {
              items: { include: { variant: { include: { product: true } } } },
              payments: true,
              receipt: true
            }
          })
        }, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        })
      } catch (error) {
        if (!this.shouldRetrySaleCreation(error)) {
          throw error
        }

        if (attempt === MAX_SALE_CREATE_RETRIES) {
          throw new SaleCreationConflictError(
            'Sale creation conflicted with another request. Please retry.'
          )
        }
      }
    }

    throw new SaleCreationConflictError('Sale creation conflicted with another request. Please retry.')
  }

  async getSalesByShop(shopId: string) {
    return this.prisma.sale.findMany({
      where: { shopId },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        payments: true,
        receipt: { select: { id: true, receiptNumber: true, status: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  async getSaleShop(shopId: string) {
    return this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true }
    })
  }

  async getSalesByOrganization(organizationId: string, shopIds?: string[]) {
    return this.prisma.sale.findMany({
      where: {
        shop: {
          organizationId,
          ...(shopIds ? { id: { in: shopIds } } : {})
        }
      },
      include: {
        shop: { select: { id: true, name: true } },
        items: { include: { variant: { include: { product: true } } } },
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  async getSaleById(saleId: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        payments: true
      }
    })

    if (!sale) {
      throw new Error('Sale not found')
    }

    return sale
  }

  async refundSale(saleId: string, refundedBy: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { items: true, payments: true }
      })

      if (!sale) throw new Error('Sale not found')
      if (sale.status === SaleStatus.REFUNDED) throw new Error('Already refunded')

      await tx.sale.update({
        where: { id: saleId },
        data: { status: SaleStatus.REFUNDED }
      })

      for (const item of sale.items) {
        await this.inventoryService.restoreRefundStock({
          shopId: sale.shopId,
          ...(item.inventoryId ? { inventoryId: item.inventoryId } : {}),
          variantId: item.variantId,
          batchNumber: item.batchNumber ?? 'DEFAULT',
          quantity: item.quantity,
          saleId: sale.id
        }, tx)
      }

      await this.cashFlowService.record(tx, {
        shopId: sale.shopId,
        direction: 'OUT',
        category: 'REFUND',
        amount: sale.total,
        referenceId: sale.id,
        note: `Refund for sale #${sale.id}`,
        recordedBy: refundedBy
      })

      await this.receiptService.voidForSale(saleId, tx)

      return tx.sale.findUnique({
        where: { id: saleId },
        include: {
          items: { include: { variant: { include: { product: true } } } },
          payments: true,
          receipt: true
        }
      })
    })
  }
}
