import { PrismaClient, Prisma, InventoryTxnType } from '@prisma/client'
import { UpdateInventoryRequest, AdjustInventoryRequest } from './types'

type TxClient = Prisma.TransactionClient

export class InventoryService {
  constructor(private prisma: PrismaClient) {}

  private db(tx?: TxClient): TxClient | PrismaClient {
    return tx ?? this.prisma
  }

  async assertShopAccess(shopId: string, userId: string, role: string, tx?: TxClient): Promise<void> {
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return

    const db = this.db(tx)
    const shop = await db.shop.findUnique({
      where: { id: shopId },
      include: {
        staff: {
          where: { userId }
        }
      }
    })

    if (!shop) throw new Error(`Shop ${shopId} not found`)
    if (shop.ownerId !== userId && shop.staff.length === 0) {
      throw new Error(`Access denied to shop ${shopId}`)
    }
  }

  async assertSameOrg(shopId: string, variantIds: string[], tx?: TxClient): Promise<void> {
    const db = this.db(tx)

    const shop = await db.shop.findUnique({ where: { id: shopId } })
    if (!shop) throw new Error(`Shop ${shopId} not found`)

    // Unique variant IDs to avoid redundant lookups
    const uniqueIds = [...new Set(variantIds)]

    const variants = await db.productVariant.findMany({
      where: { id: { in: uniqueIds } },
      include: { product: true }
    })

    const foreignVariant = variants.find(v => v.product.organizationId !== shop.organizationId)
    if (foreignVariant) {
      throw new Error(
        `Variant ${foreignVariant.id} does not belong to organization ${shop.organizationId}`
      )
    }
  }

  async updateInventory(data: UpdateInventoryRequest, tx?: TxClient) {
    const { shopId, variantId, batchNumber = 'DEFAULT', expiryDate, quantity, costPrice } = data

    await this.assertSameOrg(shopId, [variantId], tx)

    return this.db(tx).inventory.upsert({
      where: {
        shopId_variantId_batchNumber: { shopId, variantId, batchNumber }
      },
      update: {
        quantity,
        costPrice,
        ...(expiryDate && { expiryDate: new Date(expiryDate) })
      },
      create: {
        shopId,
        variantId,
        batchNumber,
        quantity,
        costPrice,
        ...(expiryDate && { expiryDate: new Date(expiryDate) })
      }
    })
  }

  async receivePurchaseBatch(
    data: {
      shopId: string
      variantId: string
      batchNumber: string
      expiryDate?: Date
      quantity: number
      costPrice: number
      purchaseId: string
    },
    tx?: TxClient
  ): Promise<string> { // Return the inventory ID
    await this.assertSameOrg(data.shopId, [data.variantId], tx)
    const db = this.db(tx)

    const inv = await db.inventory.upsert({
      where: {
        shopId_variantId_batchNumber: {
          shopId: data.shopId,
          variantId: data.variantId,
          batchNumber: data.batchNumber
        }
      },
      update: {
        quantity: { increment: data.quantity },
        costPrice: data.costPrice,
        ...(data.expiryDate && { expiryDate: data.expiryDate })
      },
      create: {
        shopId: data.shopId,
        variantId: data.variantId,
        batchNumber: data.batchNumber,
        quantity: data.quantity,
        costPrice: data.costPrice,
        ...(data.expiryDate && { expiryDate: data.expiryDate })
      }
    })

    await db.inventoryTransaction.create({
      data: {
        shopId: data.shopId,
        variantId: data.variantId,
        inventoryId: inv.id,
        batchNumber: data.batchNumber,
        type: InventoryTxnType.PURCHASE,
        quantity: data.quantity,
        referenceId: data.purchaseId
      }
    })

    return inv.id
  }

  async deductSaleStockFEFO(
    data: {
      shopId: string
      variantId: string
      quantity: number
      saleId: string
    },
    tx?: TxClient
  ): Promise<{ inventoryId: string, quantity: number }[]> {
    await this.assertSameOrg(data.shopId, [data.variantId], tx)
    const db = this.db(tx)

    const availableBatches = await db.inventory.findMany({
      where: {
        shopId: data.shopId,
        variantId: data.variantId,
        quantity: { gt: 0 }
      },
      orderBy: { expiryDate: 'asc' }
    })

    const allocations: { inventoryId: string, quantity: number }[] = []
    let remainingQuantity = data.quantity

    for (const batch of availableBatches) {
      if (remainingQuantity <= 0) break

      const deductAmount = Math.min(batch.quantity, remainingQuantity)
      remainingQuantity -= deductAmount

      // Update inventory directly
      await db.inventory.update({
        where: { id: batch.id },
        data: { quantity: { decrement: deductAmount } }
      })

      // Record transaction
      await db.inventoryTransaction.create({
        data: {
          shopId: data.shopId,
          variantId: data.variantId,
          inventoryId: batch.id,
          batchNumber: batch.batchNumber, // Still keeping for audit/legacy
          type: InventoryTxnType.SALE,
          quantity: -deductAmount,
          referenceId: data.saleId
        }
      })

      allocations.push({ inventoryId: batch.id, quantity: deductAmount })
    }

    if (remainingQuantity > 0) {
      throw new Error(`Insufficient stock for variant ${data.variantId}. Short by ${remainingQuantity}`)
    }

    return allocations
  }

  async restoreRefundStock(
    data: {
      shopId: string
      variantId: string
      allocations: { inventoryId: string, quantity: number }[]
      saleId: string
    },
    tx?: TxClient
  ): Promise<void> {
    await this.assertSameOrg(data.shopId, [data.variantId], tx)
    const db = this.db(tx)

    for (const allocation of data.allocations) {
      const inv = await db.inventory.update({
        where: { id: allocation.inventoryId },
        data: { quantity: { increment: allocation.quantity } }
      })

      await db.inventoryTransaction.create({
        data: {
          shopId: data.shopId,
          variantId: data.variantId,
          inventoryId: inv.id,
          batchNumber: inv.batchNumber,
          type: InventoryTxnType.RETURN,
          quantity: allocation.quantity,
          referenceId: data.saleId
        }
      })
    }
  }

  async adjustInventory(data: AdjustInventoryRequest & { costPrice?: number }, tx?: TxClient) {
    const { shopId, variantId, batchNumber = 'DEFAULT', change, type, referenceId, costPrice } = data
    
    await this.assertSameOrg(shopId, [variantId], tx)
    const db = this.db(tx)

    let inventoryId: string | undefined

    if (change < 0) {
      const targetInv = await db.inventory.findUnique({
        where: { shopId_variantId_batchNumber: { shopId, variantId, batchNumber } }
      })

      if (!targetInv || targetInv.quantity < Math.abs(change)) {
        throw new Error(`Insufficient inventory for variant ${variantId} and batch ${batchNumber}`)
      }

      const updatedInv = await db.inventory.update({
        where: { id: targetInv.id },
        data: { quantity: { increment: change } }
      })
      inventoryId = updatedInv.id
    } else {
      if (costPrice === undefined || costPrice <= 0) {
        throw new Error('costPrice is required and must be > 0 for positive adjustments')
      }
      const inv = await db.inventory.upsert({
        where: {
          shopId_variantId_batchNumber: { shopId, variantId, batchNumber }
        },
        update: {
          quantity: { increment: change }
        },
        create: {
          shopId,
          variantId,
          batchNumber,
          quantity: change,
          costPrice: costPrice
        }
      })
      inventoryId = inv.id
    }

    await db.inventoryTransaction.create({
      data: {
        shopId,
        variantId,
        inventoryId,
        batchNumber,
        type: type ?? InventoryTxnType.ADJUSTMENT,
        quantity: change,
        referenceId: referenceId ?? null
      }
    })
  }

  async getInventoryByShop(shopId: string) {
    return this.prisma.inventory.findMany({
      where: { shopId },
      include: { variant: { include: { product: true } } }
    })
  }

  async getBatchesByVariant(shopId: string, variantId: string) {
    return this.prisma.inventory.findMany({
      where: {
        shopId,
        variantId,
        quantity: { gt: 0 }
      },
      orderBy: { expiryDate: 'asc' }
    })
  }

  async getTransactionsByShop(shopId: string, cursor?: string, take = 50) {
    return this.prisma.inventoryTransaction.findMany({
      where: { shopId },
      take,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: 'desc' },
      include: { variant: { include: { product: true } } }
    })
  }
}
