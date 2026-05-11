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
      // 1. Calculate price and stock first
      let computedTotalAmount = 0
      for (const item of data.items) {
        // Resolve selling price with fallback
        if (item.price === undefined) {
          const pricing = await this.pricingService.getSellingPrice(data.shopId, item.variantId, tx)
          if (!pricing || !pricing.sellingPrice) {
            throw new Error(`Cannot resolve pricing for variant ${item.variantId}`)
          }
          item.price = Number(pricing.sellingPrice)
        }

        computedTotalAmount += item.quantity * item.price

        // Store intermediate result on item to process allocations later
        const allocations = await this.inventoryService.deductSaleStockFEFO({
          shopId: data.shopId,
          variantId: item.variantId,
          quantity: item.quantity,
          saleId: 'TBD'
        }, tx)
        
        ;(item as any)._allocations = allocations
      }

      const totalAmount = data.totalAmount ?? computedTotalAmount

      // 3. Create Sale Record
      const sale = await tx.sale.create({
        data: {
          shopId: data.shopId,
          customerId: data.customerId,
          totalAmount,
          method: data.method,
          status: data.paymentStatus === 'PAID' ? SaleStatus.COMPLETED : SaleStatus.PENDING,
          createdBy: data.createdBy,
        }
      })

      // 4. Create Sale Items and update inventory transaction links
      for (const item of data.items) {
        const saleItem = await tx.saleItem.create({
          data: {
            saleId: sale.id,
            variantId: item.variantId,
            batchNumber: 'DEPRECATED',
            quantity: item.quantity,
            price: item.price!,
            allocations: {
              create: ((item as any)._allocations || []).map((alloc: any) => ({
                inventoryId: alloc.inventoryId,
                batchNumber: 'DEPRECATED',
                quantity: alloc.quantity
              }))
            }
          }
        })
      }

      // Hack to patch inventory deduction referenceId (since we didn't know the saleId during deduct)
      await tx.inventoryTransaction.updateMany({
        where: { shopId: data.shopId, referenceId: 'TBD', type: 'SALE' },
        data: { referenceId: sale.id }
      })

      // 5. Register Cashflow if paid
      if (data.paymentStatus === 'PAID') {
        await this.cashFlowService.recordInflow({
          shopId: data.shopId,
          amount: totalAmount,
          category: 'SALES',
          referenceId: sale.id,
          description: `Sale #${sale.id}`,
          createdBy: data.createdBy
        }, tx)
      }

      return sale
    })
  }

  async refundSale(saleId: string, refundedBy: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { items: { include: { allocations: true } } }
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
          allocations: item.allocations.map(a => ({
            inventoryId: a.inventoryId,
            quantity: a.quantity
          })),
          saleId: sale.id
        }, tx)
      }

      await this.cashFlowService.recordOutflow({
        shopId: sale.shopId,
        amount: Number(sale.totalAmount),
        category: 'REFUNDS',
        referenceId: sale.id,
        description: `Refund for sale #${sale.id}`,
        createdBy: refundedBy
      }, tx)

      return sale
    })
  }
}
