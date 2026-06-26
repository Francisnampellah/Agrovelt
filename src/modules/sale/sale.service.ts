import { PrismaClient, SaleStatus } from '@prisma/client'
import { InventoryService } from '../inventory/inventory.service'
import { CashFlowService } from '../cashflow/cashflow.service'
import { PricingService } from '../pricing/pricing.service'
import { CreateSaleRequest } from './types'

export class SaleService {
  constructor(
    private prisma: PrismaClient,
    private inventoryService: InventoryService,
    private cashFlowService: CashFlowService,
    private pricingService: PricingService
  ) {}

  async createSale(data: CreateSaleRequest) {
    const variantIds = data.items.map(i => i.variantId)
    await this.inventoryService.assertSameOrg(data.shopId, variantIds)

    return this.prisma.$transaction(async (tx) => {
      let subtotal = 0
      const resolvedItems: Array<{
        variantId: string
        quantity: number
        price: number
        batchNumber: string
      }> = []

      for (const item of data.items) {
        let price = item.price
        if (price === undefined) {
          price = await this.pricingService.resolveSellingPrice(data.shopId, item.variantId)
        } else {
          await this.pricingService.validateSalePrice(data.shopId, item.variantId, price)
        }

        const batchNumber = item.batchNumber ?? 'DEFAULT'
        subtotal += item.quantity * price
        resolvedItems.push({
          variantId: item.variantId,
          quantity: item.quantity,
          price,
          batchNumber
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
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            variantId: item.variantId,
            batchNumber: item.batchNumber,
            quantity: item.quantity,
            price: item.price
          }
        })

        await this.inventoryService.deductSaleStock({
          shopId: data.shopId,
          variantId: item.variantId,
          batchNumber: item.batchNumber,
          quantity: item.quantity,
          saleId: sale.id
        }, tx)
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

      return tx.sale.findUnique({
        where: { id: sale.id },
        include: {
          items: { include: { variant: { include: { product: true } } } },
          payments: true
        }
      })
    })
  }

  async getSalesByShop(shopId: string) {
    return this.prisma.sale.findMany({
      where: { shopId },
      include: {
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

      return tx.sale.findUnique({
        where: { id: saleId },
        include: {
          items: { include: { variant: { include: { product: true } } } },
          payments: true
        }
      })
    })
  }
}
