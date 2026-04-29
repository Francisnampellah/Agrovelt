import { PrismaClient, InventoryTxnType } from '@prisma/client'
import { UpdateInventoryRequest, AdjustInventoryRequest } from './types'

export class InventoryService {
  constructor(private prisma: PrismaClient) {}

  async updateInventory(data: UpdateInventoryRequest) {
    const { shopId, variantId, batchNumber = 'DEFAULT', expiryDate, quantity, costPrice, sellingPrice } = data

    // Check if shop exists
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } })
    if (!shop) throw new Error('Shop not found')

    // Check if variant exists
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } })
    if (!variant) throw new Error('Product variant not found')

    return this.prisma.inventory.upsert({
      where: {
        shopId_variantId_batchNumber: { shopId, variantId, batchNumber }
      },
      update: {
        quantity,
        costPrice,
        sellingPrice,
        ...(expiryDate && { expiryDate: new Date(expiryDate) })
      },
      create: {
        shopId,
        variantId,
        batchNumber,
        quantity,
        costPrice,
        sellingPrice,
        ...(expiryDate && { expiryDate: new Date(expiryDate) })
      }
    })
  }

  async adjustInventory(data: AdjustInventoryRequest) {
    const { shopId, variantId, batchNumber = 'DEFAULT', change, type, referenceId } = data

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Inventory Level
      const inventory = await tx.inventory.upsert({
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
          costPrice: 0, // Should be updated properly through purchases
          sellingPrice: 0
        }
      })

      if (inventory.quantity < 0) {
        throw new Error('Insufficient inventory')
      }

      // 2. Record Transaction
      await tx.inventoryTransaction.create({
        data: {
          shopId,
          variantId,
          batchNumber,
          type,
          quantity: change,
          referenceId: referenceId ?? null
        }
      })

      return inventory
    })
  }

  async getInventoryByShop(shopId: string) {
    return this.prisma.inventory.findMany({
      where: { shopId },
      include: {
        variant: {
          include: {
            product: true
          }
        }
      }
    })
  }

  async getTransactionsByShop(shopId: string) {
    return this.prisma.inventoryTransaction.findMany({
      where: { shopId },
      include: {
        variant: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  }
}
