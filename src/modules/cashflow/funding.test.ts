import test from 'node:test'
import assert from 'node:assert/strict'
import { CashFlowService } from './cashflow.service'
import { canAddOrgFunding } from '../auth/permissions'

test('recordFunding creates an IN adjustment with the default organization-funding note', async () => {
  const created: unknown[] = []
  const prisma = {
    cashFlowEntry: {
      create: async ({ data }: { data: unknown }) => {
        created.push(data)
      }
    }
  }

  const service = new CashFlowService(prisma as never)
  await service.recordFunding('shop-1', 2500, 'user-1')

  assert.deepEqual(created, [{
    shopId: 'shop-1',
    amount: 2500,
    recordedBy: 'user-1',
    direction: 'IN',
    category: 'ADJUSTMENT',
    note: 'Organization funding'
  }])
})

test('organization funding denies ONE_SHOP managers but allows ALL_SHOPS managers and owners', () => {
  assert.equal(canAddOrgFunding({
    userId: 'manager-one',
    role: 'MANAGER',
    managerAccess: 'ONE_SHOP'
  }), false)
  assert.equal(canAddOrgFunding({
    userId: 'manager-all',
    role: 'MANAGER',
    managerAccess: 'ALL_SHOPS'
  }), true)
  assert.equal(canAddOrgFunding({
    userId: 'owner',
    role: 'OWNER'
  }), true)
})
