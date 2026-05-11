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
    inventoryId?: string // User can select an existing inventoryId to "top up" a batch
    batchNumber?: string // Legacy/Manual override
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
        let finalBatchNumber: string
        let finalInventoryId: string | undefined = item.inventoryId

        if (finalInventoryId) {
          // If user selected an existing inventory record, fetch its batch number
          const existingInv = await tx.inventory.findUnique({
            where: { id: finalInventoryId }
          })
          if (!existingInv) throw new Error(`Inventory record ${finalInventoryId} not found`)
          finalBatchNumber = existingInv.batchNumber
        } else {
          // Else generate a new batch only
          finalBatchNumber = item.batchNumber || `BATCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
        }

        // 3. Update inventory stock and batch cost using the service boundary
        const inventoryId = await this.inventoryService.receivePurchaseBatch({
          shopId: data.shopId,
          variantId: item.variantId,
          batchNumber: finalBatchNumber,
          expiryDate: item.expiryDate,
          quantity: item.quantity,
          costPrice: item.costPrice,
          purchaseId: purchase.id
        }, tx)

        // 2. Create purchase line item (Linked to Inventory)
        await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            variantId: item.variantId,
            inventoryId: inventoryId,
            batchNumber: finalBatchNumber,
            quantity: item.quantity,
            costPrice: item.costPrice,
            expiryDate: item.expiryDate
          }
        })

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