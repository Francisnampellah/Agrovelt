import { PrismaClient, Prisma, InventoryTxnType } from '@prisma/client'
import { UpdateInventoryRequest, AdjustInventoryRequest } from './types'

type TxClient = Prisma.TransactionClient

type SaleStockTarget = {
  shopId: string
  variantId: string
  inventoryId?: string
  batchNumber?: string
  quantity: number
  saleId: string
}

type RefundStockTarget = {
  shopId: string
  variantId: string
  inventoryId?: string
  batchNumber: string
  quantity: number
  saleId: string
}

type ResolvedInventoryRow = {
  id: string
  shopId: string
  variantId: string
  batchNumber: string
  quantity: number
}

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

    const uniqueIds = [...new Set(variantIds)]
    const count = await db.productVariant.count({
      where: { id: { in: uniqueIds } }
    })

    if (count !== uniqueIds.length) {
      throw new Error('One or more product variants not found')
    }
  }

  async updateInventory(data: UpdateInventoryRequest, tx?: TxClient) {
    const { shopId, variantId, batchNumber = 'DEFAULT', expiryDate, quantity, costPrice } = data

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

  private async resolveSaleInventoryRow(
    data: Omit<SaleStockTarget, 'quantity' | 'saleId'>,
    tx?: TxClient
  ): Promise<ResolvedInventoryRow> {
    const db = this.db(tx)

    if (data.inventoryId) {
      const inventory = await db.inventory.findUnique({
        where: { id: data.inventoryId },
        select: {
          id: true,
          shopId: true,
          variantId: true,
          batchNumber: true,
          quantity: true
        }
      })

      if (!inventory) {
        throw new Error('inventory_row_not_found')
      }
      if (inventory.shopId !== data.shopId) {
        throw new Error('inventory_row_shop_mismatch')
      }
      if (inventory.variantId !== data.variantId) {
        throw new Error('inventory_row_variant_mismatch')
      }
      // inventoryId is source of truth for row selection; batch is optional validation only.
      if (
        data.batchNumber !== undefined &&
        data.batchNumber !== inventory.batchNumber
      ) {
        throw new Error('inventory_row_batch_mismatch')
      }

      return inventory
    }

    const inventory = await db.inventory.findUnique({
      where: {
        shopId_variantId_batchNumber: {
          shopId: data.shopId,
          variantId: data.variantId,
          batchNumber: data.batchNumber ?? 'DEFAULT'
        }
      },
      select: {
        id: true,
        shopId: true,
        variantId: true,
        batchNumber: true,
        quantity: true
      }
    })

    if (!inventory) {
      throw new Error(
        `Insufficient stock for variant ${data.variantId} batch ${data.batchNumber ?? 'DEFAULT'}`
      )
    }

    return inventory
  }

  async deductSaleStock(
    data: SaleStockTarget,
    tx?: TxClient
  ): Promise<{ inventoryId: string; batchNumber: string }> {
    const db = this.db(tx)
    const inventory = await this.resolveSaleInventoryRow(data, tx)

    const result = await db.inventory.updateMany({
      where: {
        id: inventory.id,
        shopId: data.shopId,
        variantId: data.variantId,
        quantity: { gte: data.quantity }
      },
      data: { quantity: { decrement: data.quantity } }
    })

    if (result.count === 0) {
      const freshRow = await db.inventory.findUnique({
        where: { id: inventory.id },
        select: {
          id: true,
          shopId: true,
          variantId: true,
          batchNumber: true,
          quantity: true
        }
      })

      if (!freshRow) {
        throw new Error(data.inventoryId ? 'inventory_row_not_found' : 'inventory_insufficient_stock')
      }
      if (freshRow.shopId !== data.shopId) {
        throw new Error('inventory_row_shop_mismatch')
      }
      if (freshRow.variantId !== data.variantId) {
        throw new Error('inventory_row_variant_mismatch')
      }
      if (freshRow.quantity < data.quantity) {
        throw new Error(
          data.inventoryId
            ? 'inventory_insufficient_stock'
            : `Insufficient stock for variant ${data.variantId} batch ${inventory.batchNumber}`
        )
      }

      throw new Error('inventory_row_update_conflict')
    }

    await db.inventoryTransaction.create({
      data: {
        shopId: data.shopId,
        variantId: data.variantId,
        batchNumber: inventory.batchNumber,
        type: InventoryTxnType.SALE,
        quantity: -data.quantity,
        referenceId: data.saleId
      }
    })

    return {
      inventoryId: inventory.id,
      batchNumber: inventory.batchNumber
    }
  }

  async restoreRefundStock(
    data: RefundStockTarget,
    tx?: TxClient
  ): Promise<void> {
    const db = this.db(tx)

    if (data.inventoryId) {
      const inventory = await db.inventory.findUnique({
        where: { id: data.inventoryId },
        select: { id: true, shopId: true, variantId: true, batchNumber: true }
      })

      if (!inventory) {
        throw new Error('inventory_row_not_found')
      }
      if (inventory.shopId !== data.shopId) {
        throw new Error('inventory_row_shop_mismatch')
      }
      if (inventory.variantId !== data.variantId) {
        throw new Error('inventory_row_variant_mismatch')
      }

      await db.inventory.update({
        where: { id: data.inventoryId },
        data: { quantity: { increment: data.quantity } }
      })
    } else {
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
    }

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

  async getInventoryByOrganization(organizationId: string, shopIds?: string[]) {
    return this.prisma.inventory.findMany({
      where: {
        shop: {
          organizationId,
          ...(shopIds ? { id: { in: shopIds } } : {})
        }
      },
      include: {
        shop: { select: { id: true, name: true, type: true, location: true } },
        variant: { include: { product: true } }
      },
      orderBy: { updatedAt: 'desc' }
    })
  }

  async getTransactionsByOrganization(
    organizationId: string,
    filters: { shopId?: string; shopIds?: string[]; cursor?: string; take?: number } = {}
  ) {
    const { shopId, shopIds, cursor, take = 50 } = filters

    return this.prisma.inventoryTransaction.findMany({
      where: {
        shop: { organizationId },
        ...(shopId ? { shopId } : {}),
        ...(shopIds ? { shopId: { in: shopIds } } : {})
      },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        shop: { select: { id: true, name: true } },
        variant: { include: { product: true } }
      }
    })
  }

  async getStockSummaryByOrganization(
    organizationId: string,
    lowStockThreshold = 10,
    shopIds?: string[]
  ) {
    const rows = await this.getInventoryByOrganization(organizationId, shopIds)

    const byVariantMap = new Map<
      string,
      {
        variantId: string
        variantName: string
        sku: string
        productId: string
        productName: string
        totalQuantity: number
        batchCount: number
        shops: { shopId: string; shopName: string; quantity: number }[]
      }
    >()

    let totalUnits = 0

    for (const row of rows) {
      totalUnits += row.quantity

      const existing = byVariantMap.get(row.variantId)
      if (existing) {
        existing.totalQuantity += row.quantity
        existing.batchCount += 1
        const shopRow = existing.shops.find(s => s.shopId === row.shopId)
        if (shopRow) {
          shopRow.quantity += row.quantity
        } else {
          existing.shops.push({
            shopId: row.shop.id,
            shopName: row.shop.name,
            quantity: row.quantity
          })
        }
      } else {
        byVariantMap.set(row.variantId, {
          variantId: row.variantId,
          variantName: row.variant.name,
          sku: row.variant.sku,
          productId: row.variant.productId,
          productName: row.variant.product.name,
          totalQuantity: row.quantity,
          batchCount: 1,
          shops: [{
            shopId: row.shop.id,
            shopName: row.shop.name,
            quantity: row.quantity
          }]
        })
      }
    }

    const byVariant = Array.from(byVariantMap.values())
      .sort((a, b) => a.productName.localeCompare(b.productName))

    const lowStockCount = byVariant.filter(v => v.totalQuantity <= lowStockThreshold).length

    return {
      totalSkus: byVariant.length,
      totalUnits,
      totalBatches: rows.length,
      lowStockThreshold,
      lowStockCount,
      byVariant
    }
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
