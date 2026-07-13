import assert from 'node:assert/strict'
import test from 'node:test'
import { OrgUsersService } from './org-users.service'

type UserRow = {
  id: string
  name: string
  email: string
  passwordHash: string | null
  firebaseUid: string | null
  role: string
  organizationId: string | null
  managerAccess: string | null
  isActive: boolean
}

type ShopStaffRow = {
  shopId: string
  userId: string
  role: string
}

function createPrismaFixture(shoppingOrganizationId = 'org-1') {
  const users: UserRow[] = []
  const shopStaff: ShopStaffRow[] = []
  const shops = [{ id: 'shop-1', organizationId: shoppingOrganizationId, name: 'Main shop' }]

  const tx = {
    user: {
      create: async ({ data }: any) => {
        const user = {
          id: `user-${users.length + 1}`,
          isActive: true,
          firebaseUid: null,
          ...data
        }
        users.push(user)
        return user
      },
      findUnique: async ({ where, select }: any) => {
        const user = where.email
          ? users.find(candidate => candidate.email === where.email)
          : users.find(candidate => candidate.id === where.id)
        if (!user) return null
        if (!select) return user

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          managerAccess: user.managerAccess,
          isActive: user.isActive,
          firebaseUid: user.firebaseUid,
          staffIn: shopStaff
            .filter(assignment => assignment.userId === user.id)
            .map(assignment => ({
              shopId: assignment.shopId,
              role: assignment.role,
              shop: shops.find(shop => shop.id === assignment.shopId)
            }))
        }
      },
      findFirst: async ({ where }: any) =>
        users.find(user => user.id === where.id && user.organizationId === where.organizationId) ?? null,
      update: async ({ where, data }: any) => {
        const user = users.find(candidate => candidate.id === where.id)
        if (!user) throw new Error('User not found')
        Object.assign(user, data)
        return user
      },
      findMany: async ({ where, select }: any) =>
        users.filter(user => user.organizationId === where.organizationId).map(user => ({
          ...(select
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                organizationId: user.organizationId,
                managerAccess: user.managerAccess,
                isActive: user.isActive,
                firebaseUid: user.firebaseUid
              }
            : user),
          staffIn: shopStaff
            .filter(assignment => assignment.userId === user.id)
            .map(assignment => ({
              ...(select ? { shopId: assignment.shopId, role: assignment.role } : assignment),
              shop: shops.find(shop => shop.id === assignment.shopId)
            }))
        }))
    },
    shopStaff: {
      create: async ({ data }: any) => {
        shopStaff.push(data)
        return data
      },
      deleteMany: async ({ where }: any) => {
        const initialCount = shopStaff.length
        for (let index = shopStaff.length - 1; index >= 0; index--) {
          if (shopStaff[index]!.userId === where.userId) shopStaff.splice(index, 1)
        }
        return { count: initialCount - shopStaff.length }
      }
    }
  }

  return {
    users,
    shopStaff,
    prisma: {
      organization: {
        findUnique: async ({ where }: any) =>
          where.id === 'org-1' || where.id === shoppingOrganizationId
            ? { id: where.id, name: 'Test Org', slug: 'test-org' }
            : null
      },
      shop: {
        findFirst: async ({ where }: any) =>
          shops.find(shop => shop.id === where.id && shop.organizationId === where.organizationId) ?? null
      },
      user: tx.user,
      $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)
    }
  }
}

const owner = { userId: 'owner-1', role: 'OWNER', organizationId: 'org-1' }
const staffInput = {
  name: 'Staff User',
  email: 'staff@example.com',
  password: 'password',
  phoneNumber: '0712345678',
  role: 'STAFF' as const,
  shopId: 'shop-1'
}

const mockProvisionFirebase = async () => ({ uid: `fb-${Date.now()}-${Math.random()}` })

function createService(prisma: unknown) {
  return new OrgUsersService(prisma as never, mockProvisionFirebase)
}

test('createOrgUser rejects STAFF without shopId', async () => {
  const fixture = createPrismaFixture()
  const service = createService(fixture.prisma)

  await assert.rejects(
    service.createOrgUser(owner, 'org-1', {
      name: staffInput.name,
      email: staffInput.email,
      password: staffInput.password,
      phoneNumber: staffInput.phoneNumber,
      role: 'STAFF'
    }),
    /shopId is required/
  )
})

test('createOrgUser creates STAFF with one ShopStaff assignment and no manager access', async () => {
  const fixture = createPrismaFixture()
  const provisionCalls: any[] = []
  const service = new OrgUsersService(fixture.prisma as never, async (input) => {
    provisionCalls.push(input)
    return { uid: 'firebase-uid-1' }
  })

  const user = await service.createOrgUser(owner, 'org-1', staffInput)

  assert.equal(user.role, 'STAFF')
  assert.equal(user.managerAccess, null)
  assert.equal(user.firebaseUid, 'firebase-uid-1')
  assert.equal('passwordHash' in user, false)
  assert.equal(user.staffIn[0]!.shop.id, 'shop-1')
  assert.deepEqual(fixture.shopStaff, [{ shopId: 'shop-1', userId: user.id, role: 'STAFF' }])
  assert.deepEqual(provisionCalls[0], {
    email: 'staff@example.com',
    password: 'password',
    displayName: 'Staff User',
    phoneNo: '0712345678',
    organization: {
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org'
    }
  })
})

test('createOrgUser rejects ALL_SHOPS manager with shopId', async () => {
  const fixture = createPrismaFixture()
  const service = createService(fixture.prisma)

  await assert.rejects(
    service.createOrgUser(owner, 'org-1', {
      ...staffInput,
      role: 'MANAGER',
      managerAccess: 'ALL_SHOPS'
    }),
    /shopId is not allowed/
  )
})

test('createOrgUser rejects ONE_SHOP manager without shopId', async () => {
  const fixture = createPrismaFixture()
  const service = createService(fixture.prisma)

  await assert.rejects(
    service.createOrgUser(owner, 'org-1', {
      name: staffInput.name,
      email: staffInput.email,
      password: staffInput.password,
      phoneNumber: staffInput.phoneNumber,
      role: 'MANAGER',
      managerAccess: 'ONE_SHOP'
    }),
    /shopId is required/
  )
})

test('createOrgUser creates ALL_SHOPS manager without ShopStaff assignments', async () => {
  const fixture = createPrismaFixture()
  const service = createService(fixture.prisma)

  const user = await service.createOrgUser(owner, 'org-1', {
    name: staffInput.name,
    email: staffInput.email,
    password: staffInput.password,
    phoneNumber: staffInput.phoneNumber,
    role: 'MANAGER',
    managerAccess: 'ALL_SHOPS'
  })

  assert.equal(user.role, 'MANAGER')
  assert.equal(user.managerAccess, 'ALL_SHOPS')
  assert.ok(user.firebaseUid)
  assert.deepEqual(fixture.shopStaff, [])
})

test('createOrgUser rejects invite without phoneNumber', async () => {
  const fixture = createPrismaFixture()
  const service = createService(fixture.prisma)

  await assert.rejects(
    service.createOrgUser(owner, 'org-1', {
      name: staffInput.name,
      email: staffInput.email,
      password: staffInput.password,
      phoneNumber: '',
      role: 'STAFF',
      shopId: 'shop-1'
    } as any),
    /phoneNumber is required/
  )
})

test('createOrgUser rejects actors without user-management permission', async () => {
  const fixture = createPrismaFixture()
  const service = createService(fixture.prisma)

  await assert.rejects(
    service.createOrgUser({ userId: 'staff-1', role: 'STAFF', organizationId: 'org-1' }, 'org-1', staffInput),
    /Insufficient permissions|User management/
  )

  await assert.rejects(
    service.createOrgUser(
      { userId: 'manager-1', role: 'MANAGER', organizationId: 'org-1', managerAccess: 'ALL_SHOPS' },
      'org-1',
      staffInput
    ),
    /Insufficient permissions|User management/
  )
})

test('createOrgUser allows ADMIN and SUPER_ADMIN to register STAFF for an organization shop', async () => {
  const fixture = createPrismaFixture()
  const service = createService(fixture.prisma)

  const adminUser = await service.createOrgUser(
    { userId: 'admin-1', role: 'ADMIN' },
    'org-1',
    { ...staffInput, email: 'admin-created-staff@example.com' }
  )
  assert.equal(adminUser.role, 'STAFF')
  assert.equal(adminUser.organizationId, 'org-1')
  assert.equal(fixture.shopStaff.some(row => row.userId === adminUser.id && row.shopId === 'shop-1'), true)

  const superAdminUser = await service.createOrgUser(
    { userId: 'super-1', role: 'SUPER_ADMIN' },
    'org-1',
    {
      name: 'Manager User',
      email: 'super-created-manager@example.com',
      password: 'password1',
      phoneNumber: '0755555555',
      role: 'MANAGER',
      managerAccess: 'ONE_SHOP',
      shopId: 'shop-1'
    }
  )
  assert.equal(superAdminUser.role, 'MANAGER')
  assert.equal(superAdminUser.managerAccess, 'ONE_SHOP')
})

test('createOrgUser rejects OWNER from a different organization', async () => {
  const fixture = createPrismaFixture()
  const service = createService(fixture.prisma)

  await assert.rejects(
    service.createOrgUser(
      { userId: 'owner-2', role: 'OWNER', organizationId: 'org-2' },
      'org-1',
      staffInput
    ),
    /Access denied to this organization/
  )
})

test('createOrgUser rejects shops outside the organization', async () => {
  const fixture = createPrismaFixture('org-2')
  const service = createService(fixture.prisma)

  await assert.rejects(service.createOrgUser(owner, 'org-1', staffInput), /Shop not found in this organization/)
})

test('updateOrgUser removes ShopStaff rows when switching to ALL_SHOPS', async () => {
  const fixture = createPrismaFixture()
  fixture.users.push({
    id: 'manager-1',
    name: 'Manager',
    email: 'manager@example.com',
    passwordHash: 'hash',
    firebaseUid: 'fb-manager-1',
    role: 'MANAGER',
    organizationId: 'org-1',
    managerAccess: 'ONE_SHOP',
    isActive: true
  })
  fixture.shopStaff.push({ shopId: 'shop-1', userId: 'manager-1', role: 'MANAGER' })
  const service = createService(fixture.prisma)

  const user = await service.updateOrgUser(owner, 'org-1', 'manager-1', {
    role: 'MANAGER',
    managerAccess: 'ALL_SHOPS'
  })

  assert.equal(fixture.users[0]!.managerAccess, 'ALL_SHOPS')
  assert.equal('passwordHash' in user, false)
  assert.deepEqual(fixture.shopStaff, [])
})

test('listOrgUsers includes each user shop assignment and manager access', async () => {
  const fixture = createPrismaFixture()
  fixture.users.push({
    id: 'staff-1',
    name: 'Staff',
    email: 'staff@example.com',
    passwordHash: 'hash',
    firebaseUid: 'fb-staff-1',
    role: 'STAFF',
    organizationId: 'org-1',
    managerAccess: null,
    isActive: true
  })
  fixture.shopStaff.push({ shopId: 'shop-1', userId: 'staff-1', role: 'STAFF' })
  const service = createService(fixture.prisma)

  const users = await service.listOrgUsers(owner, 'org-1')

  assert.equal(users[0]!.managerAccess, null)
  assert.equal(users[0]!.staffIn[0]!.shop.id, 'shop-1')
  assert.equal('passwordHash' in users[0]!, false)
})

test('listOrgUsers rejects actors without user-management permission', async () => {
  const fixture = createPrismaFixture()
  const service = createService(fixture.prisma)

  for (const actor of [
    { userId: 'staff-1', role: 'STAFF' as const, organizationId: 'org-1' },
    { userId: 'manager-1', role: 'MANAGER' as const, organizationId: 'org-1', managerAccess: 'ALL_SHOPS' as const }
  ]) {
    await assert.rejects(service.listOrgUsers(actor, 'org-1'), /Insufficient permissions|User management/)
  }
})

test('deactivateOrgUser marks the organization user inactive', async () => {
  const fixture = createPrismaFixture()
  fixture.users.push({
    id: 'staff-1',
    name: 'Staff',
    email: 'staff@example.com',
    passwordHash: 'hash',
    firebaseUid: 'fb-staff-1',
    role: 'STAFF',
    organizationId: 'org-1',
    managerAccess: null,
    isActive: true
  })
  const service = createService(fixture.prisma)

  await service.deactivateOrgUser(owner, 'org-1', 'staff-1')

  assert.equal(fixture.users[0]!.isActive, false)
})
