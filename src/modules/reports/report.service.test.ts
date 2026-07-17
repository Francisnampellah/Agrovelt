import assert from 'node:assert/strict'
import test from 'node:test'
import { canGenerateBusinessReport } from '../auth/permissions'
import { normalizeReportRequest } from './normalize'
import { ReportApiError } from './report.errors'
import { resolveReportShops } from './report.scope'
import { BusinessReportService } from './report.service'

test('canGenerateBusinessReport allows managers and denies staff', () => {
  assert.equal(canGenerateBusinessReport({ userId: '1', role: 'OWNER' }), true)
  assert.equal(canGenerateBusinessReport({ userId: '1', role: 'MANAGER', managerAccess: 'ONE_SHOP' }), true)
  assert.equal(canGenerateBusinessReport({ userId: '1', role: 'MANAGER', managerAccess: 'ALL_SHOPS' }), true)
  assert.equal(canGenerateBusinessReport({ userId: '1', role: 'STAFF' }), false)
})

test('normalizeReportRequest rejects ranges over 366 days', () => {
  assert.throws(
    () =>
      normalizeReportRequest({
        from: '2025-01-01T00:00:00.000Z',
        to: '2026-12-31T23:59:59.999Z'
      }),
    (error: unknown) =>
      error instanceof ReportApiError && error.code === 'REPORT_RANGE_TOO_LARGE'
  )
})

test('normalizeReportRequest rejects unsupported payment methods', () => {
  assert.throws(
    () =>
      normalizeReportRequest({
        from: '2026-07-01T00:00:00.000Z',
        to: '2026-07-07T23:59:59.999Z',
        filters: { paymentMethods: ['MPESA' as never] }
      }),
    (error: unknown) =>
      error instanceof ReportApiError && error.code === 'REPORT_PAYMENT_METHOD_INVALID'
  )
})

test('resolveReportShops denies STAFF and scopes ONE_SHOP manager', async () => {
  const prisma = {
    shop: {
      findMany: async ({ where }: any) => {
        if (where.id?.in) {
          return [{ id: 'shop-1', name: 'Main' }]
        }
        return [
          { id: 'shop-1', name: 'Main' },
          { id: 'shop-2', name: 'Branch' }
        ]
      }
    },
    user: {
      findUnique: async () => ({
        role: 'MANAGER',
        organizationId: 'org-1',
        managerAccess: 'ONE_SHOP',
        shopsOwned: [],
        staffIn: [{ shop: { id: 'shop-1', name: 'Main' } }]
      })
    }
  }

  await assert.rejects(
    resolveReportShops(prisma as never, { userId: 'staff-1', role: 'STAFF', organizationId: 'org-1' }, 'org-1'),
    (error: unknown) => error instanceof ReportApiError && error.status === 403
  )

  const scoped = await resolveReportShops(
    prisma as never,
    { userId: 'mgr-1', role: 'MANAGER', organizationId: 'org-1', managerAccess: 'ONE_SHOP' },
    'org-1'
  )
  assert.deepEqual(scoped.shopIds, ['shop-1'])

  await assert.rejects(
    resolveReportShops(
      prisma as never,
      { userId: 'mgr-1', role: 'MANAGER', organizationId: 'org-1', managerAccess: 'ONE_SHOP' },
      'org-1',
      ['shop-2']
    ),
    (error: unknown) =>
      error instanceof ReportApiError && error.code === 'REPORT_SHOP_OUT_OF_SCOPE'
  )
})

test('BusinessReportService.generate builds summary, omits unused sections, and persists', async () => {
  const created: any[] = []
  const prisma = {
    shop: {
      findMany: async () => [{ id: 'shop-1', name: 'Main' }]
    },
    user: {
      findUnique: async () => ({
        role: 'OWNER',
        organizationId: 'org-1',
        managerAccess: null,
        shopsOwned: [],
        staffIn: []
      })
    },
    sale: {
      aggregate: async () => ({ _sum: { total: 1000 }, _count: { _all: 2 } }),
      findMany: async () => [
        { createdAt: new Date('2026-07-02T10:00:00.000Z'), total: 600 },
        { createdAt: new Date('2026-07-03T10:00:00.000Z'), total: 400 }
      ],
      groupBy: async () => []
    },
    cashFlowEntry: {
      aggregate: async ({ where }: any) => {
        if (where.category === 'REFUND') return { _sum: { amount: 100 }, _count: { _all: 1 } }
        return { _sum: { amount: 500 }, _count: { _all: 1 } }
      },
      findMany: async () => []
    },
    expense: {
      aggregate: async () => ({ _sum: { amount: 200 }, _count: { _all: 1 } }),
      findMany: async () => [{ date: new Date('2026-07-02T00:00:00.000Z'), amount: 200 }],
      groupBy: async () => []
    },
    purchase: {
      aggregate: async () => ({ _sum: { totalAmount: 300 }, _count: { _all: 1 } }),
      findMany: async () => []
    },
    inventory: {
      findMany: async () => [
        {
          quantity: 5,
          costPrice: 10,
          variantId: 'var-1',
          shopId: 'shop-1',
          variant: { id: 'var-1', sku: 'SKU-1', productId: 'p-1', product: { id: 'p-1', name: 'Feed' } }
        }
      ]
    },
    saleItem: {
      findMany: async () => [
        {
          variantId: 'var-1',
          quantity: 2,
          price: 50,
          variant: { id: 'var-1', sku: 'SKU-1', productId: 'p-1', product: { name: 'Feed' } }
        }
      ]
    },
    payment: { groupBy: async () => [] },
    inventoryTransaction: { findMany: async () => [] },
    receipt: { findMany: async () => [] },
    businessReport: {
      create: async ({ data }: any) => {
        created.push(data)
        return { id: 'report-1', ...data }
      }
    }
  }

  const service = new BusinessReportService(prisma as never)
  const report = await service.generate(
    { userId: 'owner-1', role: 'OWNER', organizationId: 'org-1' },
    'org-1',
    {
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-07T23:59:59.999Z',
      include: {
        summary: true,
        cashMovement: true,
        timeline: true,
        topProducts: true,
        inventorySnapshot: false,
        sales: false,
        productMovements: false
      }
    }
  ) as any

  assert.equal(report.meta.reportId, 'report-1')
  assert.equal(report.summary.revenue, 1000)
  assert.equal(report.summary.refunds, 100)
  assert.equal(report.summary.funding, 500)
  assert.equal(report.summary.netCash, 1000 + 500 - 200 - 300 - 100)
  assert.ok(report.cashMovement)
  assert.ok(report.timeline)
  assert.ok(report.topProducts)
  assert.equal(report.inventorySnapshot, undefined)
  assert.equal(report.transactions, undefined)
  assert.equal(created.length, 1)
  assert.equal(created[0].organizationId, 'org-1')
})

test('BusinessReportService.list denies STAFF', async () => {
  const service = new BusinessReportService({} as never)
  await assert.rejects(
    service.list({ userId: 's1', role: 'STAFF', organizationId: 'org-1' }, 'org-1'),
    (error: unknown) => error instanceof ReportApiError && error.status === 403
  )
})
