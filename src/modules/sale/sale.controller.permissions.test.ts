import test from 'node:test'
import assert from 'node:assert/strict'
import { SaleController } from './sale.controller'

test('sale creation returns 403 when the shop is outside the actor scope', async () => {
  const dbUser = {
    role: 'STAFF',
    organizationId: 'org-1',
    managerAccess: null,
    isActive: true,
    staffIn: [{ shop: { id: 'shop-1', name: 'Assigned' } }],
    shopsOwned: []
  }
  const prisma = {
    user: { findUnique: async () => dbUser },
    shop: { findMany: async () => [] }
  }
  const controller = new SaleController(
    { createSale: async () => assert.fail('sale must not be created') } as never,
    {} as never,
    prisma as never
  )
  let statusCode: number | undefined
  let responseBody: unknown
  const res = {
    status(code: number) {
      statusCode = code
      return this
    },
    json(body: unknown) {
      responseBody = body
      return this
    }
  }

  await controller.create({
    body: { shopId: 'shop-2', paymentMethod: 'CASH', items: [{ variantId: 'variant-1', quantity: 1 }] },
    user: { userId: 'user-1', email: 'staff@example.com', role: 'STAFF' }
  } as never, res as never)

  assert.equal(statusCode, 403)
  assert.deepEqual(responseBody, { error: 'Access denied to this shop' })
})

test('sale listing returns 403 when the shop is outside the actor scope', async () => {
  const dbUser = {
    role: 'STAFF',
    organizationId: 'org-1',
    managerAccess: null,
    isActive: true,
    staffIn: [{ shop: { id: 'shop-1', name: 'Assigned' } }],
    shopsOwned: []
  }
  const prisma = {
    user: { findUnique: async () => dbUser },
    shop: { findMany: async () => [] }
  }
  const controller = new SaleController(
    { getSalesByShop: async () => [] } as never,
    {} as never,
    prisma as never
  )
  let statusCode: number | undefined
  let responseBody: unknown
  const res = {
    status(code: number) {
      statusCode = code
      return this
    },
    json(body: unknown) {
      responseBody = body
      return this
    }
  }

  await controller.list({
    query: { shopId: 'shop-2' },
    user: { userId: 'user-1', email: 'staff@example.com', role: 'STAFF' }
  } as never, res as never)

  assert.equal(statusCode, 403)
  assert.deepEqual(responseBody, { error: 'Access denied to this shop' })
})
