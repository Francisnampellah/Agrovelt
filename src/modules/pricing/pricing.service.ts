import { PrismaClient } from '@prisma/client'

export class PricingService {
  constructor(private prisma: PrismaClient) {}

  async resolveSellingPrice(shopId: string, variantId: string, inventoryId?: string): Promise<number> {
    // Priority 1: the specific batch's own price (SaleRecordDrawer.jsx
    // always sends an explicit price today, so this rarely fires from the
    // web UI - it's here for any caller that omits one).
    if (inventoryId) {
      const inventory = await this.prisma.inventory.findUnique({
        where: { id: inventoryId }
      })
      if (inventory?.sellingPrice != null) return inventory.sellingPrice
    }

    // Priority 2: Shop-level override
    const shopPrice = await this.prisma.shopVariantPrice.findUnique({
      where: { shopId_variantId: { shopId, variantId } }
    })
    if (shopPrice) return shopPrice.sellingPrice

    // Priority 3: Variant-level default
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId }
    })
    if (variant?.defaultSellingPrice) return variant.defaultSellingPrice

    throw new Error(
      `No selling price configured for variant ${variantId} in shop ${shopId}. ` +
      `Set a default on the variant or a shop override.`
    )
  }

  async updateShopSellingPrice(params: {
    shopId: string
    variantId: string
    newPrice: number
    minSellingPrice?: number
    reason?: string
    changedBy: string
  }): Promise<void> {
    const existing = await this.prisma.shopVariantPrice.findUnique({
      where: { shopId_variantId: { shopId: params.shopId, variantId: params.variantId } }
    })

    await this.prisma.$transaction(async (tx) => {
      await tx.shopVariantPrice.upsert({
        where: { shopId_variantId: { shopId: params.shopId, variantId: params.variantId } },
        update: {
          sellingPrice: params.newPrice,
          ...(params.minSellingPrice !== undefined && { minSellingPrice: params.minSellingPrice }),
          updatedBy: params.changedBy
        },
        create: {
          shopId: params.shopId,
          variantId: params.variantId,
          sellingPrice: params.newPrice,
          ...(params.minSellingPrice !== undefined && { minSellingPrice: params.minSellingPrice }),
          updatedBy: params.changedBy
        }
      })

      // Always log the change
      if (existing?.sellingPrice !== params.newPrice || existing?.minSellingPrice !== params.minSellingPrice) {
        await tx.priceHistory.create({
          data: {
            shopId: params.shopId,
            variantId: params.variantId,
            priceType: 'SELLING',
            oldPrice: existing?.sellingPrice ?? 0,
            newPrice: params.newPrice,
            ...(params.reason !== undefined && { reason: params.reason }),
            changedBy: params.changedBy
          }
        })
      }
    })
  }

  async validateSalePrice(shopId: string, variantId: string, chargedPrice: number): Promise<void> {
    const shopPrice = await this.prisma.shopVariantPrice.findUnique({
      where: { shopId_variantId: { shopId, variantId } }
    })

    if (shopPrice?.minSellingPrice !== null && shopPrice?.minSellingPrice !== undefined && chargedPrice < shopPrice.minSellingPrice) {
      throw new Error(
        `Charged price ${chargedPrice} is below the minimum allowed price of ${shopPrice.minSellingPrice}`
      )
    }
  }
}