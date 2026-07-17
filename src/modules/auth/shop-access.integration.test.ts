import test from 'node:test'
import assert from 'node:assert/strict'
import { AuthMiddleware } from './auth.middleware'
import { ShopController } from '../shops/shop.controller'
import { OrganizationController } from '../organizations/organization.controller'

const assignedShop = { id: 'shop-1', name: 'Assigned' }
const otherShop = { id: 'shop-2', name: 'Other' }

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      response.statusCode = code
      return response
    },
    json(body: unknown) {
      response.body = body
      return response
    }
  }

  return response
}

function scopedUser(role: string, managerAccess: 'ONE_SHOP' | 'ALL_SHOPS' | null = null) {
  return {
    id: 'user-1',
    role,
    organizationId: 'org-1',
    managerAccess,
    isActive: true,
    staffIn: [{ shop: assignedShop }],
    shopsOwned: []
  }
}

test('requireShopAccess lets an owner access another shop in their organization', async () => {
  const prisma = {
    user: { findUnique: async () => scopedUser('OWNER') },
    shop: {
      findMany: async () => [assignedShop, otherShop],
      findUnique: async () => ({ organizationId: 'org-1', ownerId: 'another-user', staff: [] })
    }
  }
  const middleware = new AuthMiddleware({ prisma } as never)
  const response = createResponse()
  let proceeded = false

  await middleware.requireShopAccess(
    { user: { userId: 'user-1', role: 'OWNER', organizationId: 'org-1' }, params: { shopId: 'shop-2' } } as never,
    response as never,
    () => { proceeded = true }
  )

  assert.equal(proceeded, true)
  assert.equal(response.statusCode, 200)
})

test('ShopController.getAll limits staff to assigned shops', async () => {
  const prisma = {
    user: { findUnique: async () => scopedUser('STAFF') },
    shop: { findMany: async () => [assignedShop, otherShop] }
  }
  const controller = new ShopController({
    prisma,
    getAllShops: async () => [assignedShop, otherShop]
  } as never)
  const response = createResponse()

  await controller.getAll(
    { user: { userId: 'user-1', role: 'STAFF', organizationId: 'org-1' } } as never,
    response as never
  )

  assert.deepEqual(response.body, { data: [assignedShop] })
})

test('OrganizationController.getShops limits one-shop managers to assigned shops', async () => {
  const prisma = {
    organization: { findUnique: async () => ({ id: 'org-1' }) },
    user: { findUnique: async () => scopedUser('MANAGER', 'ONE_SHOP') },
    shop: { findMany: async () => [assignedShop, otherShop] }
  }
  const controller = new OrganizationController(
    {} as never,
    {} as never,
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      getAllShops: async () => [assignedShop, otherShop]
    } as never,
    {} as never
  )
  const response = createResponse()

  await controller.getShops(
    {
      user: {
        userId: 'user-1',
        role: 'MANAGER',
        organizationId: 'org-1',
        managerAccess: 'ONE_SHOP'
      },
      params: { id: 'org-1' }
    } as never,
    response as never
  )

  assert.deepEqual(response.body, { data: [assignedShop] })
})
