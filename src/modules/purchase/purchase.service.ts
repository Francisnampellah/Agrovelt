import { PrismaClient, CashFlowCategory, CashFlowDirection } from '@prisma/client'
import { InventoryService } from '../inventory/inventory.service'
import { PricingService } from '../pricing/pricing.service'
import { CashFlowService } from '../cashflow/cashflow.service'

export interface CreatePurchaseRequest {
  shopId: string
  supplierId?: string
  createdBy: string
  items: {
    variantId: string
    quantity: number
    costPrice: number
    batchNumber?: string
    expiryDate?: Date
  }[]
}

export class PurchaseService {
  constructor(
    private prisma: PrismaClient,
    private inventoryService: InventoryService,
    private pricingService: PricingService,
    private cashFlowService: CashFlowService
  ) {}

  async createPurchase(data: CreatePurchaseRequest) {
    const variantIds = data.items.map(i => i.variantId)
    await this.inventoryService.assertSameOrg(data.shopId, variantIds)

    return this.prisma.$transaction(async (tx) => {
      // 1. Create purchase header
      const totalAmount = data.items.reduce((sum, it) => sum + (it.quantity * it.costPrice), 0)

      const purchase = await tx.purchase.create({
        data: {
          shopId: data.shopId,
          supplierId: data.supplierId,
          totalAmount,
          createdBy: data.createdBy,
        }
      })

      for (const item of data.items) {
        // 2. Create purchase line item
        await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            variantId: item.variantId,
            batchNumber: item.batchNumber,
            quantity: item.quantity,
            costPrice: item.costPrice,
            expiryDate: item.expiryDate
          }
        })

        // 3. Update inventory stock and batch cost using the service boundary
        await this.inventoryService.receivePurchaseBatch({
          shopId: data.shopId,
          variantId: item.variantId,
          batchNumber: item.batchNumber ?? 'DEFAULT',
          expiryDate: item.expiryDate,
          quantity: item.quantity,
          costPrice: item.costPrice,
          purchaseId: purchase.id
        }, tx)

        // 4. Optionally auto-update selling price based on markup
        await this.pricingService.autoUpdateSellingPriceFromCost(tx, {
          shopId: data.shopId,
          variantId: item.variantId,
          newCostPrice: item.costPrice,
          changedBy: data.createdBy
        })
      }

      // 5. Record cash outflow
      await this.cashFlowService.record(tx, {
        shopId: data.shopId,
        direction: CashFlowDirection.OUT,
        category: CashFlowCategory.PURCHASE,
        amount: totalAmount,
        referenceId: purchase.id,
        recordedBy: data.createdBy
      })

      return purchase
    })
  }

  async getPurchasesByShop(shopId: string) {
    return this.prisma.purchase.findMany({
      where: { shopId },
      include: {
        supplier: true,
        items: {
          include: {
            variant: {
              include: { product: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  }
}