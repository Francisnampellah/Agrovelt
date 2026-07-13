import test from 'node:test'
import assert from 'node:assert/strict'
import { assertShopInScope, resolveShopScope } from './shopScope'

type UserRecord = {
  id: string
  role: string
  organizationId: string | null
  managerAccess: 'ONE_SHOP' | 'ALL_SHOPS' | null
  staffIn: { shop: { id: string; name: string } }[]
  shopsOwned: { id: string; name: string }[]
}

function createPrisma(user: UserRecord, shops = [
  { id: 's1', name: 'Main', organizationId: 'org1' },
  { id: 's2', name: 'Branch', organizationId: 'org1' },
  { id: 's3', name: 'Other', organizationId: 'org2' }
]) {
  return {
    user: {
      findUnique: async () => user
    },
    shop: {
      findMany: async ({ where }: { where: { organizationId: string } }) =>
        shops
          .filter(shop => shop.organizationId === where.organizationId)
          .sort((left, right) => left.name.localeCompare(right.name))
          .map(({ id, name }) => ({ id, name })),
      findUnique: async ({ where }: { where: { id: string } }) =>
        shops.find(shop => shop.id === where.id) ?? null
    }
  }
}

test('STAFF scope is exactly assigned shop', async () => {
  const prisma = createPrisma({
    id: 'u1',
    role: 'STAFF',
    organizationId: 'org1',
    managerAccess: null,
    staffIn: [{ shop: { id: 's1', name: 'Main' } }],
    shopsOwned: []
  })

  const scope = await resolveShopScope(prisma as never, {
    userId: 'u1',
    role: 'STAFF',
    organizationId: 'org1'
  })

  assert.equal(scope.allShops, false)
  assert.deepEqual(scope.shopIds, ['s1'])
})

test('ONE_SHOP manager scope is exactly assigned shop', async () => {
  const prisma = createPrisma({
    id: 'u1',
    role: 'MANAGER',
    organizationId: 'org1',
    managerAccess: 'ONE_SHOP',
    staffIn: [{ shop: { id: 's1', name: 'Main' } }],
    shopsOwned: []
  })

  const scope = await resolveShopScope(prisma as never, {
    userId: 'u1',
    role: 'MANAGER',
    organizationId: 'org1',
    managerAccess: 'ONE_SHOP'
  })

  assert.equal(scope.allShops, false)
  assert.deepEqual(scope.shopIds, ['s1'])
})

test('ALL_SHOPS manager scope contains every organization shop', async () => {
  const prisma = createPrisma({
    id: 'u1',
    role: 'MANAGER',
    organizationId: 'org1',
    managerAccess: 'ALL_SHOPS',
    staffIn: [],
    shopsOwned: []
  })

  const scope = await resolveShopScope(prisma as never, {
    userId: 'u1',
    role: 'MANAGER',
    organizationId: 'org1',
    managerAccess: 'ALL_SHOPS'
  })

  assert.equal(scope.allShops, true)
  assert.deepEqual(scope.shopIds, ['s2', 's1'])
})

test('OWNER scope contains every organization shop', async () => {
  const prisma = createPrisma({
    id: 'u1',
    role: 'OWNER',
    organizationId: 'org1',
    managerAccess: null,
    staffIn: [],
    shopsOwned: [{ id: 's1', name: 'Main' }]
  })

  const scope = await resolveShopScope(prisma as never, {
    userId: 'u1',
    role: 'OWNER',
    organizationId: 'org1'
  })

  assert.equal(scope.allShops, true)
  assert.deepEqual(scope.shopIds, ['s2', 's1'])
})

test('assertShopInScope rejects shops outside the assigned scope', async () => {
  const prisma = createPrisma({
    id: 'u1',
    role: 'STAFF',
    organizationId: 'org1',
    managerAccess: null,
    staffIn: [{ shop: { id: 's1', name: 'Main' } }],
    shopsOwned: []
  })

  await assert.rejects(
    assertShopInScope(prisma as never, { userId: 'u1', role: 'STAFF', organizationId: 'org1' }, 's2'),
    /Access denied to this shop/
  )
})

test('assertShopInScope rejects all-shop actors outside their organization', async () => {
  for (const actor of [
    { userId: 'u1', role: 'MANAGER', organizationId: 'org1', managerAccess: 'ALL_SHOPS' as const },
    { userId: 'u1', role: 'OWNER', organizationId: 'org1' }
  ]) {
    const prisma = createPrisma({
      id: 'u1',
      role: actor.role,
      organizationId: 'org1',
      managerAccess: actor.managerAccess ?? null,
      staffIn: [],
      shopsOwned: []
    })

    await assert.doesNotReject(assertShopInScope(prisma as never, actor, 's1'))
    await assert.rejects(assertShopInScope(prisma as never, actor, 's3'), /Access denied to this shop/)
  }
})
