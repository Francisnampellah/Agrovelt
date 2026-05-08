import { PrismaClient, Prisma } from '@prisma/client'

export class PricingService {
  constructor(private prisma: PrismaClient) {}

  async resolveSellingPrice(shopId: string, variantId: string): Promise<number> {
    // Priority 1: Shop-level override
    const shopPrice = await this.prisma.shopVariantPrice.findUnique({
      where: { shopId_variantId: { shopId, variantId } }
    })
    if (shopPrice) return shopPrice.sellingPrice

    // Priority 2: Variant-level default
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
          minSellingPrice: params.minSellingPrice,
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
            reason: params.reason,
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

  async autoUpdateSellingPriceFromCost(
    tx: Prisma.TransactionClient,
    params: { shopId: string; variantId: string; newCostPrice: number; changedBy: string }
  ): Promise<void> {
    const variant = await tx.productVariant.findUnique({ where: { id: params.variantId } })

    if (!variant?.markupPercent) return // Auto-pricing not configured; manual override required

    const newSellingPrice = parseFloat(
      (params.newCostPrice * (1 + variant.markupPercent / 100)).toFixed(2)
    )

    // Using transaction client for inner update to ensure atomicity within the same tx
    const existing = await tx.shopVariantPrice.findUnique({
      where: { shopId_variantId: { shopId: params.shopId, variantId: params.variantId } }
    })

    await tx.shopVariantPrice.upsert({
      where: { shopId_variantId: { shopId: params.shopId, variantId: params.variantId } },
      update: {
        sellingPrice: newSellingPrice,
        updatedBy: params.changedBy
      },
      create: {
        shopId: params.shopId,
        variantId: params.variantId,
        sellingPrice: newSellingPrice,
        updatedBy: params.changedBy
      }
    })

    if (existing?.sellingPrice !== newSellingPrice) {
      await tx.priceHistory.create({
        data: {
          shopId: params.shopId,
          variantId: params.variantId,
          priceType: 'SELLING',
          oldPrice: existing?.sellingPrice ?? 0,
          newPrice: newSellingPrice,
          reason: `Auto-calculated: cost ${params.newCostPrice} + ${variant.markupPercent}% markup`,
          changedBy: params.changedBy
        }
      })
    }
  }
}