import test from 'node:test'
import assert from 'node:assert/strict'
import { ReceiptService } from './receipt.service'

type ReceiptCreateInput = {
  data: {
    receiptNumber: string
    saleId: string
    organizationId: string
    shopId: string
    issuedBy: string
    notes?: string
  }
}

function createConcurrentReceiptDb() {
  const counters = new Map<string, number>()
  const receiptNumbers = new Set<string>()

  return {
    counters,
    receiptNumbers,
    createTx() {
      return {
        async $queryRaw(_query: TemplateStringsArray, organizationId: string, timestampKey: string) {
          await Promise.resolve()
          const counterKey = `${organizationId}:${timestampKey}`
          const nextValue = (counters.get(counterKey) ?? 0) + 1
          counters.set(counterKey, nextValue)
          return [{ lastValue: nextValue }]
        },
        receipt: {
          create: async ({ data }: ReceiptCreateInput) => {
            await Promise.resolve()
            if (receiptNumbers.has(data.receiptNumber)) {
              throw { code: 'P2002', meta: { target: ['receiptNumber'] } }
            }

            receiptNumbers.add(data.receiptNumber)
            return { id: data.saleId, ...data }
          }
        }
      }
    }
  }
}

test('createForSale keeps receipt numbers unique under concurrent requests', async () => {
  const service = new ReceiptService({} as never)
  const db = createConcurrentReceiptDb()

  const receipts = await Promise.all(
    Array.from({ length: 25 }, (_, index) =>
      service.createForSale(
        {
          saleId: `sale-${index + 1}`,
          shopId: 'shop-1',
          organizationId: 'org-1',
          issuedBy: 'user-1'
        },
        db.createTx() as never
      )
    )
  )

  assert.equal(receipts.length, 25)
  assert.equal(new Set(receipts.map(receipt => receipt.receiptNumber)).size, 25)
  assert.equal(db.receiptNumbers.size, 25)
  for (const receipt of receipts) {
    assert.match(receipt.receiptNumber, /^RCP-\d{17}-\d{4}$/)
  }
})

test('createForSale retries automatically when a generated receipt number collides', async () => {
  const service = new ReceiptService({} as never)
  let counter = 0
  let createAttempts = 0

  const tx = {
    async $queryRaw() {
      counter += 1
      return [{ lastValue: counter }]
    },
    receipt: {
      create: async ({ data }: ReceiptCreateInput) => {
        createAttempts += 1
        if (createAttempts === 1) {
          throw { code: 'P2002', meta: { target: ['receiptNumber'] } }
        }

        return { id: data.saleId, ...data }
      }
    }
  }

  const receipt = await service.createForSale(
    {
      saleId: 'sale-retry',
      shopId: 'shop-1',
      organizationId: 'org-1',
      issuedBy: 'user-1'
    },
    tx as never
  )

  assert.equal(createAttempts, 2)
  assert.match(receipt.receiptNumber, /^RCP-\d{17}-0002$/)
})
