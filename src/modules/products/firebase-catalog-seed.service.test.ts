import test from 'node:test'
import assert from 'node:assert/strict'
import { mapMnyamaShopProduct, parseAgrovetCatalog } from './firebase-catalog-seed.service'

// Real doc shape pasted from Firestore during the seed-structure investigation.
const NEW_STRUCTURE_DOC = {
  id: 'pCIKlo0MaozGls4uPacC',
  data: {
    agrovet_catalog: {
      category_id: null,
      default_variant_id: 'a7bb56db-bde0-4fda-88fa-d12a1cedc343',
      product_id: '1f96f0bf-4a8d-411c-8de2-20d34a4dd8a6',
      sync_error: null,
      sync_status: 'synced',
      synced_at: '2026-07-09T00:00:48.000Z'
    },
    base_price_constant: 1000.0000303030303,
    category: 'Animal Vaccine',
    description_html: '<p>random desc</p>',
    description_text: 'random desc ',
    is_sensor: false,
    name: 'test product',
    published: true,
    quantity_in_stock: '82',
    variants: [
      {
        base_price_constant: 1000.0000303030303,
        default_cost_price: 1000,
        default_selling_price: 1000,
        discount_rate_constant: 0.0000030303030303030305,
        max_op: '999997',
        max_oq: '1000',
        min_op: '10000',
        min_oq: '10',
        name: 'test variant',
        quantity_in_stock: '82',
        sku: 'test-variant-sku',
        variant_id: 'a7bb56db-bde0-4fda-88fa-d12a1cedc343'
      },
      {
        base_price_constant: 1009.0909090909091,
        default_cost_price: 1000,
        default_selling_price: 1000,
        discount_rate_constant: 0.09090909090909091,
        max_op: '1000000',
        max_oq: '10000',
        min_op: '100000',
        min_oq: '100',
        name: 'test variant 2',
        quantity_in_stock: '1000',
        sku: 'test-variant-sku-2',
        variant_id: '738b9b7d-c047-4067-a96b-d9dd1b910701'
      }
    ]
  }
}

test('parseAgrovetCatalog reads default_variant_id from the new structure', () => {
  const link = parseAgrovetCatalog(NEW_STRUCTURE_DOC.data)
  assert.ok(link)
  assert.equal(link!.defaultVariantId, 'a7bb56db-bde0-4fda-88fa-d12a1cedc343')
  assert.equal(link!.productId, '1f96f0bf-4a8d-411c-8de2-20d34a4dd8a6')
})

test('parseAgrovetCatalog returns null for the old structure (variant_id only, no default_variant_id)', () => {
  const link = parseAgrovetCatalog({
    agrovet_catalog: {
      variant_id: 'a7bb56db-bde0-4fda-88fa-d12a1cedc343',
      product_id: '1f96f0bf-4a8d-411c-8de2-20d34a4dd8a6'
    }
  })
  assert.equal(link, null)
})

test('parseAgrovetCatalog returns null when agrovet_catalog is absent (sensor products, unsynced products)', () => {
  assert.equal(parseAgrovetCatalog({}), null)
  assert.equal(parseAgrovetCatalog({ agrovet_catalog: null }), null)
})

test('mapMnyamaShopProduct syncs every variant in the array, not just the default one', () => {
  const mapped = mapMnyamaShopProduct(NEW_STRUCTURE_DOC)
  assert.ok(mapped)
  assert.equal(mapped!.variants.length, 2)
  assert.equal(mapped!.variants[0]!.variantId, 'a7bb56db-bde0-4fda-88fa-d12a1cedc343')
  assert.equal(mapped!.variants[0]!.sku, 'test-variant-sku')
  assert.equal(mapped!.variants[1]!.variantId, '738b9b7d-c047-4067-a96b-d9dd1b910701')
  assert.equal(mapped!.variants[1]!.sku, 'test-variant-sku-2')
  assert.equal(mapped!.categoryName, 'Animal Vaccine')
})

test('mapMnyamaShopProduct returns null when variants[] is missing or empty, even with a valid link', () => {
  const noVariants = mapMnyamaShopProduct({
    id: 'doc-1',
    data: {
      name: 'No variants product',
      agrovet_catalog: {
        default_variant_id: 'a7bb56db-bde0-4fda-88fa-d12a1cedc343',
        product_id: '1f96f0bf-4a8d-411c-8de2-20d34a4dd8a6'
      },
      variants: []
    }
  })
  assert.equal(noVariants, null)
})

test('mapMnyamaShopProduct returns null for docs with no name', () => {
  const mapped = mapMnyamaShopProduct({
    id: 'doc-2',
    data: { agrovet_catalog: NEW_STRUCTURE_DOC.data.agrovet_catalog, variants: NEW_STRUCTURE_DOC.data.variants }
  })
  assert.equal(mapped, null)
})
