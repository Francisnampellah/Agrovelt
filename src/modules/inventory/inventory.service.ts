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
  ): Promise<void> {
    await this.assertSameOrg(data.shopId, [data.variantId], tx)
    const db = this.db(tx)

    await db.inventory.upsert({
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
        batchNumber: data.batchNumber,
        type: InventoryTxnType.PURCHASE,
        quantity: data.quantity,
        referenceId: data.purchaseId
      }
    })
  }

  async deductSaleStock(
    data: {
      shopId: string
      variantId: string
      batchNumber: string
      quantity: number
      saleId: string
    },
    tx?: TxClient
  ): Promise<void> {
    await this.assertSameOrg(data.shopId, [data.variantId], tx)
    const db = this.db(tx)

    const result = await db.inventory.updateMany({
      where: {
        shopId: data.shopId,
        variantId: data.variantId,
        batchNumber: data.batchNumber,
        quantity: { gte: data.quantity }
      },
      data: { quantity: { decrement: data.quantity } }
    })

    if (result.count === 0) {
      throw new Error(
        `Insufficient stock for variant ${data.variantId} batch ${data.batchNumber}`
      )
    }

    await db.inventoryTransaction.create({
      data: {
        shopId: data.shopId,
        variantId: data.variantId,
        batchNumber: data.batchNumber,
        type: InventoryTxnType.SALE,
        quantity: -data.quantity,
        referenceId: data.saleId
      }
    })
  }

  async restoreRefundStock(
    data: {
      shopId: string
      variantId: string
      batchNumber: string
      quantity: number
      saleId: string
    },
    tx?: TxClient
  ): Promise<void> {
    await this.assertSameOrg(data.shopId, [data.variantId], tx)
    const db = this.db(tx)

    await db.inventory.update({
      where: {
        shopId_variantId_batchNumber: {
          shopId: data.shopId,
          variantId: data.variantId,
          batchNumber: data.batchNumber
        }
      },
      data: { quantity: { increment: data.quantity } }
    })

    await db.inventoryTransaction.create({
      data: {
        shopId: data.shopId,
        variantId: data.variantId,
        batchNumber: data.batchNumber,
        type: InventoryTxnType.RETURN,
        quantity: data.quantity,
        referenceId: data.saleId
      }
    })
  }

  async adjustInventory(data: AdjustInventoryRequest & { costPrice?: number }, tx?: TxClient) {
    const { shopId, variantId, batchNumber = 'DEFAULT', change, type, referenceId, costPrice } = data
    
    await this.assertSameOrg(shopId, [variantId], tx)
    const db = this.db(tx)

    if (change < 0) {
      const result = await db.inventory.updateMany({
        where: {
          shopId,
          variantId,
          batchNumber,
          quantity: { gte: Math.abs(change) }
        },
        data: { quantity: { increment: change } }
      })
      if (result.count === 0) {
        throw new Error(`Insufficient inventory for variant ${variantId} and batch ${batchNumber}`)
      }
    } else {
      if (costPrice === undefined || costPrice <= 0) {
        throw new Error('costPrice is required and must be > 0 for positive adjustments')
      }
      await db.inventory.upsert({
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
    }

    await db.inventoryTransaction.create({
      data: {
        shopId,
        variantId,
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
