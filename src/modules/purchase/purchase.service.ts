import { PrismaClient, CashFlowCategory, CashFlowDirection } from '@prisma/client'
import { InventoryService } from '../inventory/inventory.service'
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
          ...(data.supplierId !== undefined ? { supplierId: data.supplierId } : {}),
          totalAmount,
          createdBy: data.createdBy
        }
      })

      for (const item of data.items) {
        await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            variantId: item.variantId,
            ...(item.batchNumber !== undefined ? { batchNumber: item.batchNumber } : {}),
            quantity: item.quantity,
            costPrice: item.costPrice,
            ...(item.expiryDate !== undefined ? { expiryDate: item.expiryDate } : {})
          }
        })

        // receivePurchaseBatch computes and sets this batch's own selling
        // price (per-variant markup, or the org default for Mnyama Shop
        // items) as part of the same write.
        await this.inventoryService.receivePurchaseBatch({
          shopId: data.shopId,
          variantId: item.variantId,
          batchNumber: item.batchNumber ?? 'DEFAULT',
          ...(item.expiryDate !== undefined ? { expiryDate: item.expiryDate } : {}),
          quantity: item.quantity,
          costPrice: item.costPrice,
          purchaseId: purchase.id
        }, tx)
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

      return tx.purchase.findUnique({
        where: { id: purchase.id },
        include: {
          shop: { select: { id: true, name: true } },
          supplier: true,
          items: {
            include: {
              variant: { include: { product: true } }
            }
          }
        }
      })
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

  async getPurchasesByOrganization(organizationId: string, shopIds?: string[]) {
    return this.prisma.purchase.findMany({
      where: {
        shop: {
          organizationId,
          ...(shopIds ? { id: { in: shopIds } } : {})
        }
      },
      include: {
        shop: { select: { id: true, name: true } },
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