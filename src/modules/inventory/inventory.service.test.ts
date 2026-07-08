import test from 'node:test'
import assert from 'node:assert/strict'
import { InventoryTxnType } from '@prisma/client'
import { InventoryService } from './inventory.service'

type InventoryRow = {
  id: string
  shopId: string
  variantId: string
  batchNumber: string
  quantity: number
}

function createInventoryTx(seedRows: InventoryRow[]) {
  const rows = new Map(seedRows.map(row => [row.id, { ...row }]))
  const inventoryTransactions: Array<{
    shopId: string
    variantId: string
    batchNumber: string | null
    type: InventoryTxnType
    quantity: number
    referenceId: string | null
  }> = []

  const getByComposite = (shopId: string, variantId: string, batchNumber: string) =>
    Array.from(rows.values()).find(row =>
      row.shopId === shopId &&
      row.variantId === variantId &&
      row.batchNumber === batchNumber
    ) ?? null

  return {
    rows,
    inventoryTransactions,
    tx: {
      inventory: {
        findUnique: async ({ where, select }: any) => {
          let row: InventoryRow | null = null

          if (where.id) {
            row = rows.get(where.id) ?? null
          } else if (where.shopId_variantId_batchNumber) {
            const key = where.shopId_variantId_batchNumber
            row = getByComposite(key.shopId, key.variantId, key.batchNumber)
          }

          if (!row) {
            return null
          }

          if (!select) {
            return { ...row }
          }

          const selected: Record<string, unknown> = {}
          for (const key of Object.keys(select)) {
            if (select[key]) {
              selected[key] = row[key as keyof InventoryRow]
            }
          }
          return selected
        },
        updateMany: async ({ where, data }: any) => {
          const row = rows.get(where.id)
          if (!row) {
            return { count: 0 }
          }
          if (where.shopId && row.shopId !== where.shopId) {
            return { count: 0 }
          }
          if (where.variantId && row.variantId !== where.variantId) {
            return { count: 0 }
          }
          if (where.quantity?.gte !== undefined && row.quantity < where.quantity.gte) {
            return { count: 0 }
          }

          row.quantity -= data.quantity.decrement
          return { count: 1 }
        },
        update: async ({ where, data }: any) => {
          const row = where.id
            ? rows.get(where.id) ?? null
            : getByComposite(
                where.shopId_variantId_batchNumber.shopId,
                where.shopId_variantId_batchNumber.variantId,
                where.shopId_variantId_batchNumber.batchNumber
              )

          if (!row) {
            throw new Error('row_not_found')
          }

          if (data.quantity?.increment !== undefined) {
            row.quantity += data.quantity.increment
          }

          return { ...row }
        }
      },
      inventoryTransaction: {
        create: async ({ data }: any) => {
          inventoryTransactions.push(data)
          return data
        }
      }
    }
  }
}

test('deductSaleStock depletes the exact inventory row when inventoryId is provided', async () => {
  const service = new InventoryService({} as never)
  const fixture = createInventoryTx([
    { id: 'inv-a', shopId: 'shop-1', variantId: 'variant-1', batchNumber: 'DEFAULT', quantity: 10 },
    { id: 'inv-b', shopId: 'shop-1', variantId: 'variant-1', batchNumber: 'BATCH-2', quantity: 8 }
  ])

  const result = await service.deductSaleStock({
    inventoryId: 'inv-b',
    shopId: 'shop-1',
    variantId: 'variant-1',
    quantity: 3,
    saleId: 'sale-1'
  }, fixture.tx as never)

  assert.deepEqual(result, { inventoryId: 'inv-b', batchNumber: 'BATCH-2' })
  assert.equal(fixture.rows.get('inv-a')?.quantity, 10)
  assert.equal(fixture.rows.get('inv-b')?.quantity, 5)
  assert.deepEqual(fixture.inventoryTransactions[0], {
    shopId: 'shop-1',
    variantId: 'variant-1',
    batchNumber: 'BATCH-2',
    type: InventoryTxnType.SALE,
    quantity: -3,
    referenceId: 'sale-1'
  })
})

test('deductSaleStock rejects inventory rows from another shop', async () => {
  const service = new InventoryService({} as never)
  const fixture = createInventoryTx([
    { id: 'inv-a', shopId: 'shop-2', variantId: 'variant-1', batchNumber: 'DEFAULT', quantity: 10 }
  ])

  await assert.rejects(
    service.deductSaleStock({
      inventoryId: 'inv-a',
      shopId: 'shop-1',
      variantId: 'variant-1',
      quantity: 1,
      saleId: 'sale-1'
    }, fixture.tx as never),
    /inventory_row_shop_mismatch/
  )
})

test('deductSaleStock rejects inventory rows with variant mismatch', async () => {
  const service = new InventoryService({} as never)
  const fixture = createInventoryTx([
    { id: 'inv-a', shopId: 'shop-1', variantId: 'variant-2', batchNumber: 'DEFAULT', quantity: 10 }
  ])

  await assert.rejects(
    service.deductSaleStock({
      inventoryId: 'inv-a',
      shopId: 'shop-1',
      variantId: 'variant-1',
      quantity: 1,
      saleId: 'sale-1'
    }, fixture.tx as never),
    /inventory_row_variant_mismatch/
  )
})

test('deductSaleStock rejects insufficient stock on an exact inventory row', async () => {
  const service = new InventoryService({} as never)
  const fixture = createInventoryTx([
    { id: 'inv-a', shopId: 'shop-1', variantId: 'variant-1', batchNumber: 'DEFAULT', quantity: 2 }
  ])

  await assert.rejects(
    service.deductSaleStock({
      inventoryId: 'inv-a',
      shopId: 'shop-1',
      variantId: 'variant-1',
      quantity: 5,
      saleId: 'sale-1'
    }, fixture.tx as never),
    /inventory_insufficient_stock/
  )
})

test('deductSaleStock still supports legacy variant plus batch resolution', async () => {
  const service = new InventoryService({} as never)
  const fixture = createInventoryTx([
    { id: 'inv-a', shopId: 'shop-1', variantId: 'variant-1', batchNumber: 'DEFAULT', quantity: 10 }
  ])

  const result = await service.deductSaleStock({
    shopId: 'shop-1',
    variantId: 'variant-1',
    batchNumber: 'DEFAULT',
    quantity: 4,
    saleId: 'sale-1'
  }, fixture.tx as never)

  assert.deepEqual(result, { inventoryId: 'inv-a', batchNumber: 'DEFAULT' })
  assert.equal(fixture.rows.get('inv-a')?.quantity, 6)
})

test('deductSaleStock accepts inventoryId together with variantId and ignores batch for row selection', async () => {
  const service = new InventoryService({} as never)
  const fixture = createInventoryTx([
    { id: 'inv-a', shopId: 'shop-1', variantId: 'variant-1', batchNumber: 'LOT-A', quantity: 10 },
    { id: 'inv-b', shopId: 'shop-1', variantId: 'variant-1', batchNumber: 'DEFAULT', quantity: 8 }
  ])

  const result = await service.deductSaleStock({
    inventoryId: 'inv-a',
    shopId: 'shop-1',
    variantId: 'variant-1',
    quantity: 2,
    saleId: 'sale-mixed'
  }, fixture.tx as never)

  assert.deepEqual(result, { inventoryId: 'inv-a', batchNumber: 'LOT-A' })
  assert.equal(fixture.rows.get('inv-a')?.quantity, 8)
  assert.equal(fixture.rows.get('inv-b')?.quantity, 8)
})

test('deductSaleStock rejects inventoryId payloads only when an explicit batch mismatches the row', async () => {
  const service = new InventoryService({} as never)
  const fixture = createInventoryTx([
    { id: 'inv-a', shopId: 'shop-1', variantId: 'variant-1', batchNumber: 'LOT-A', quantity: 10 }
  ])

  await assert.rejects(
    service.deductSaleStock({
      inventoryId: 'inv-a',
      shopId: 'shop-1',
      variantId: 'variant-1',
      batchNumber: 'DEFAULT',
      quantity: 1,
      saleId: 'sale-1'
    }, fixture.tx as never),
    /inventory_row_batch_mismatch/
  )
})

test('concurrent deductions against the same inventoryId only allow available stock once', async () => {
  const service = new InventoryService({} as never)
  const fixture = createInventoryTx([
    { id: 'inv-a', shopId: 'shop-1', variantId: 'variant-1', batchNumber: 'DEFAULT', quantity: 5 }
  ])

  const [first, second] = await Promise.allSettled([
    service.deductSaleStock({
      inventoryId: 'inv-a',
      shopId: 'shop-1',
      variantId: 'variant-1',
      quantity: 5,
      saleId: 'sale-1'
    }, fixture.tx as never),
    service.deductSaleStock({
      inventoryId: 'inv-a',
      shopId: 'shop-1',
      variantId: 'variant-1',
      quantity: 5,
      saleId: 'sale-2'
    }, fixture.tx as never)
  ])

  const fulfilled = [first, second].filter(result => result.status === 'fulfilled')
  const rejected = [first, second].filter(result => result.status === 'rejected')

  assert.equal(fulfilled.length, 1)
  assert.equal(rejected.length, 1)
  assert.equal(fixture.rows.get('inv-a')?.quantity, 0)
  assert.match(String((rejected[0] as PromiseRejectedResult).reason?.message), /inventory_insufficient_stock/)
})
