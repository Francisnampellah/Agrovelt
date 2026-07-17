import assert from 'node:assert/strict'
import test from 'node:test'
import { OrganizationController } from './organization.controller'

test('STAFF receives 403 for organization sales reports', async () => {
  const prisma = {
    organization: { findUnique: async () => ({ id: 'org-1' }) },
    user: {
      findUnique: async () => ({
        id: 'staff-1',
        role: 'STAFF',
        organizationId: 'org-1',
        managerAccess: null,
        isActive: true,
        staffIn: [{ shop: { id: 'shop-1', name: 'Assigned shop' } }],
        shopsOwned: []
      })
    }
  }
  const controller = new OrganizationController(
    {} as never,
    {} as never,
    prisma as never,
    { getSalesByOrganization: async () => assert.fail('sales must not be loaded') } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
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

  await controller.getSales({
    params: { id: 'org-1' },
    query: {},
    user: { userId: 'staff-1', email: 'staff@example.com', role: 'STAFF' }
  } as never, res as never)

  assert.equal(statusCode, 403)
  assert.deepEqual(responseBody, { error: 'Insufficient permissions to generate reports' })
})
