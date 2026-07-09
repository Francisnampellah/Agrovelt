import test from 'node:test'
import assert from 'node:assert/strict'
import { ProductService } from './products.service'

type VariantRow = { id: string; name: string; sku: string }
type UsageCounts = Record<string, number>

function createProductServiceHarness(options: {
  productId: string
  imagePath?: string | null
  variants: VariantRow[]
  // variantId -> total usage count across inventory/pricing/purchases/sales/transfers
  usage?: UsageCounts
}) {
  const { productId, imagePath = null, variants, usage = {} } = options

  const deletedVariantIds: string[] = []
  let productDeleted = false

  const usageTable = (table: string) => ({
    count: async ({ where }: { where: { variantId: string } }) => {
      // Every usage table is queried the same way; split the total usage
      // count evenly isn't meaningful for a mock, so just report it all
      // against the first table queried and zero for the rest — the
      // service only cares about the sum being > 0 or not.
      void table
      return usage[where.variantId] ? 1 : 0
    }
  })

  const prisma = {
    product: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (where.id !== productId) return null
        return { id: productId, imagePath, variants }
      },
      delete: async ({ where }: { where: { id: string } }) => {
        productDeleted = true
        return { id: where.id }
      }
    },
    productVariant: {
      deleteMany: async ({ where }: { where: { productId: string } }) => {
        for (const v of variants) {
          if (where.productId === productId) deletedVariantIds.push(v.id)
        }
        return { count: variants.length }
      }
    },
    inventory: usageTable('inventory'),
    inventoryTransaction: { count: async () => 0 },
    purchaseItem: { count: async () => 0 },
    saleItem: { count: async () => 0 },
    inventoryTransferItem: { count: async () => 0 },
    shopVariantPrice: { count: async () => 0 },
    priceHistory: { count: async () => 0 },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops)
  }

  const service = new ProductService(prisma as any)

  return { service, deletedVariantIds, wasProductDeleted: () => productDeleted }
}

test('deleteProduct deletes the product and every variant when none are in use', async () => {
  const { service, deletedVariantIds, wasProductDeleted } = createProductServiceHarness({
    productId: 'prod-1',
    variants: [
      { id: 'var-1', name: '500ml', sku: 'SKU-1' },
      { id: 'var-2', name: '1L', sku: 'SKU-2' }
    ]
  })

  await service.deleteProduct('prod-1')

  assert.deepEqual(deletedVariantIds.sort(), ['var-1', 'var-2'])
  assert.equal(wasProductDeleted(), true)
})

test('deleteProduct throws and deletes nothing when a variant is in use', async () => {
  const { service, deletedVariantIds, wasProductDeleted } = createProductServiceHarness({
    productId: 'prod-1',
    variants: [
      { id: 'var-1', name: '500ml', sku: 'SKU-1' },
      { id: 'var-2', name: '1L', sku: 'SKU-2' }
    ],
    usage: { 'var-2': 1 }
  })

  await assert.rejects(
    () => service.deleteProduct('prod-1'),
    (error: Error) => {
      assert.match(error.message, /1L \(SKU: SKU-2\)/)
      return true
    }
  )

  assert.deepEqual(deletedVariantIds, [])
  assert.equal(wasProductDeleted(), false)
})

test('deleteProduct throws Product not found for an unknown id', async () => {
  const { service } = createProductServiceHarness({ productId: 'prod-1', variants: [] })

  await assert.rejects(
    () => service.deleteProduct('does-not-exist'),
    /Product not found/
  )
})

test('deleteProduct succeeds for a product with zero variants', async () => {
  const { service, wasProductDeleted } = createProductServiceHarness({
    productId: 'prod-1',
    variants: []
  })

  await service.deleteProduct('prod-1')

  assert.equal(wasProductDeleted(), true)
})
