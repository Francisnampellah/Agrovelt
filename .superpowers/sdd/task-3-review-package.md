# Review Package Task 3 (re-review)
BASE: 9299d8c64027c471a60bf0f9d3022aa269964aa9
HEAD: 105826ef2451f4f892c7e5b7eeb2b105e8a938e0

## Commits
105826e fix(org): require auth for listOrgUsers
add1312 feat(org): add owner-scoped user create/list/update/deactivate service

## Stat
 .../organizations/org-users.service.test.ts        | 259 +++++++++++++++++++++
 src/modules/organizations/org-users.service.ts     | 156 +++++++++++++
 src/modules/organizations/types.ts                 |  18 ++
 3 files changed, 433 insertions(+)

## Diff
```diff
diff --git a/src/modules/organizations/org-users.service.test.ts b/src/modules/organizations/org-users.service.test.ts
new file mode 100644
index 0000000..828809b
--- /dev/null
+++ b/src/modules/organizations/org-users.service.test.ts
@@ -0,0 +1,259 @@
+import assert from 'node:assert/strict'
+import test from 'node:test'
+import { OrgUsersService } from './org-users.service'
+
+type UserRow = {
+  id: string
+  name: string
+  email: string
+  passwordHash: string | null
+  role: string
+  organizationId: string | null
+  managerAccess: string | null
+  isActive: boolean
+}
+
+type ShopStaffRow = {
+  shopId: string
+  userId: string
+  role: string
+}
+
+function createPrismaFixture(shoppingOrganizationId = 'org-1') {
+  const users: UserRow[] = []
+  const shopStaff: ShopStaffRow[] = []
+  const shops = [{ id: 'shop-1', organizationId: shoppingOrganizationId, name: 'Main shop' }]
+
+  const tx = {
+    user: {
+      create: async ({ data }: any) => {
+        const user = {
+          id: `user-${users.length + 1}`,
+          isActive: true,
+          ...data
+        }
+        users.push(user)
+        return user
+      },
+      findFirst: async ({ where }: any) =>
+        users.find(user => user.id === where.id && user.organizationId === where.organizationId) ?? null,
+      update: async ({ where, data }: any) => {
+        const user = users.find(candidate => candidate.id === where.id)
+        if (!user) throw new Error('User not found')
+        Object.assign(user, data)
+        return user
+      },
+      findMany: async ({ where }: any) =>
+        users.filter(user => user.organizationId === where.organizationId).map(user => ({
+          ...user,
+          staffIn: shopStaff
+            .filter(assignment => assignment.userId === user.id)
+            .map(assignment => ({
+              ...assignment,
+              shop: shops.find(shop => shop.id === assignment.shopId)
+            }))
+        }))
+    },
+    shopStaff: {
+      create: async ({ data }: any) => {
+        shopStaff.push(data)
+        return data
+      },
+      deleteMany: async ({ where }: any) => {
+        const initialCount = shopStaff.length
+        for (let index = shopStaff.length - 1; index >= 0; index--) {
+          if (shopStaff[index]!.userId === where.userId) shopStaff.splice(index, 1)
+        }
+        return { count: initialCount - shopStaff.length }
+      }
+    }
+  }
+
+  return {
+    users,
+    shopStaff,
+    prisma: {
+      shop: {
+        findFirst: async ({ where }: any) =>
+          shops.find(shop => shop.id === where.id && shop.organizationId === where.organizationId) ?? null
+      },
+      user: tx.user,
+      $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)
+    }
+  }
+}
+
+const owner = { userId: 'owner-1', role: 'OWNER', organizationId: 'org-1' }
+const staffInput = {
+  name: 'Staff User',
+  email: 'staff@example.com',
+  password: 'password',
+  role: 'STAFF' as const,
+  shopId: 'shop-1'
+}
+
+test('createOrgUser rejects STAFF without shopId', async () => {
+  const fixture = createPrismaFixture()
+  const service = new OrgUsersService(fixture.prisma as never)
+
+  await assert.rejects(
+    service.createOrgUser(owner, 'org-1', {
+      name: staffInput.name,
+      email: staffInput.email,
+      password: staffInput.password,
+      role: 'STAFF'
+    }),
+    /shopId is required/
+  )
+})
+
+test('createOrgUser creates STAFF with one ShopStaff assignment and no manager access', async () => {
+  const fixture = createPrismaFixture()
+  const service = new OrgUsersService(fixture.prisma as never)
+
+  const user = await service.createOrgUser(owner, 'org-1', staffInput)
+
+  assert.equal(user.role, 'STAFF')
+  assert.equal(user.managerAccess, null)
+  assert.deepEqual(fixture.shopStaff, [{ shopId: 'shop-1', userId: user.id, role: 'STAFF' }])
+})
+
+test('createOrgUser rejects ALL_SHOPS manager with shopId', async () => {
+  const fixture = createPrismaFixture()
+  const service = new OrgUsersService(fixture.prisma as never)
+
+  await assert.rejects(
+    service.createOrgUser(owner, 'org-1', {
+      ...staffInput,
+      role: 'MANAGER',
+      managerAccess: 'ALL_SHOPS'
+    }),
+    /shopId is not allowed/
+  )
+})
+
+test('createOrgUser rejects ONE_SHOP manager without shopId', async () => {
+  const fixture = createPrismaFixture()
+  const service = new OrgUsersService(fixture.prisma as never)
+
+  await assert.rejects(
+    service.createOrgUser(owner, 'org-1', {
+      name: staffInput.name,
+      email: staffInput.email,
+      password: staffInput.password,
+      role: 'MANAGER',
+      managerAccess: 'ONE_SHOP'
+    }),
+    /shopId is required/
+  )
+})
+
+test('createOrgUser creates ALL_SHOPS manager without ShopStaff assignments', async () => {
+  const fixture = createPrismaFixture()
+  const service = new OrgUsersService(fixture.prisma as never)
+
+  const user = await service.createOrgUser(owner, 'org-1', {
+    name: staffInput.name,
+    email: staffInput.email,
+    password: staffInput.password,
+    role: 'MANAGER',
+    managerAccess: 'ALL_SHOPS'
+  })
+
+  assert.equal(user.role, 'MANAGER')
+  assert.equal(user.managerAccess, 'ALL_SHOPS')
+  assert.deepEqual(fixture.shopStaff, [])
+})
+
+test('createOrgUser rejects actors without user-management permission', async () => {
+  const fixture = createPrismaFixture()
+  const service = new OrgUsersService(fixture.prisma as never)
+
+  await assert.rejects(
+    service.createOrgUser({ userId: 'staff-1', role: 'STAFF', organizationId: 'org-1' }, 'org-1', staffInput),
+    /Insufficient permissions|User management/
+  )
+})
+
+test('createOrgUser rejects shops outside the organization', async () => {
+  const fixture = createPrismaFixture('org-2')
+  const service = new OrgUsersService(fixture.prisma as never)
+
+  await assert.rejects(service.createOrgUser(owner, 'org-1', staffInput), /Shop not found in this organization/)
+})
+
+test('updateOrgUser removes ShopStaff rows when switching to ALL_SHOPS', async () => {
+  const fixture = createPrismaFixture()
+  fixture.users.push({
+    id: 'manager-1',
+    name: 'Manager',
+    email: 'manager@example.com',
+    passwordHash: 'hash',
+    role: 'MANAGER',
+    organizationId: 'org-1',
+    managerAccess: 'ONE_SHOP',
+    isActive: true
+  })
+  fixture.shopStaff.push({ shopId: 'shop-1', userId: 'manager-1', role: 'MANAGER' })
+  const service = new OrgUsersService(fixture.prisma as never)
+
+  await service.updateOrgUser(owner, 'org-1', 'manager-1', {
+    role: 'MANAGER',
+    managerAccess: 'ALL_SHOPS'
+  })
+
+  assert.equal(fixture.users[0]!.managerAccess, 'ALL_SHOPS')
+  assert.deepEqual(fixture.shopStaff, [])
+})
+
+test('listOrgUsers includes each user shop assignment and manager access', async () => {
+  const fixture = createPrismaFixture()
+  fixture.users.push({
+    id: 'staff-1',
+    name: 'Staff',
+    email: 'staff@example.com',
+    passwordHash: 'hash',
+    role: 'STAFF',
+    organizationId: 'org-1',
+    managerAccess: null,
+    isActive: true
+  })
+  fixture.shopStaff.push({ shopId: 'shop-1', userId: 'staff-1', role: 'STAFF' })
+  const service = new OrgUsersService(fixture.prisma as never)
+
+  const users = await service.listOrgUsers(owner, 'org-1')
+
+  assert.equal(users[0]!.managerAccess, null)
+  assert.equal(users[0]!.staffIn[0]!.shop.id, 'shop-1')
+})
+
+test('listOrgUsers rejects actors without user-management permission', async () => {
+  const fixture = createPrismaFixture()
+  const service = new OrgUsersService(fixture.prisma as never)
+
+  for (const actor of [
+    { userId: 'staff-1', role: 'STAFF' as const, organizationId: 'org-1' },
+    { userId: 'manager-1', role: 'MANAGER' as const, organizationId: 'org-1', managerAccess: 'ALL_SHOPS' as const }
+  ]) {
+    await assert.rejects(service.listOrgUsers(actor, 'org-1'), /Insufficient permissions|User management/)
+  }
+})
+
+test('deactivateOrgUser marks the organization user inactive', async () => {
+  const fixture = createPrismaFixture()
+  fixture.users.push({
+    id: 'staff-1',
+    name: 'Staff',
+    email: 'staff@example.com',
+    passwordHash: 'hash',
+    role: 'STAFF',
+    organizationId: 'org-1',
+    managerAccess: null,
+    isActive: true
+  })
+  const service = new OrgUsersService(fixture.prisma as never)
+
+  await service.deactivateOrgUser(owner, 'org-1', 'staff-1')
+
+  assert.equal(fixture.users[0]!.isActive, false)
+})
diff --git a/src/modules/organizations/org-users.service.ts b/src/modules/organizations/org-users.service.ts
new file mode 100644
index 0000000..5c99f14
--- /dev/null
+++ b/src/modules/organizations/org-users.service.ts
@@ -0,0 +1,156 @@
+import bcrypt from 'bcrypt'
+import { ManagerAccess, PrismaClient, Role } from '@prisma/client'
+import { AuthActor, canManageUsers } from '../auth/permissions'
+import { CreateOrgUserInput, UpdateOrgUserInput } from './types'
+
+type UserRole = CreateOrgUserInput['role']
+type Access = NonNullable<CreateOrgUserInput['managerAccess']>
+
+export class OrgUsersService {
+  constructor(private prisma: PrismaClient) {}
+
+  async createOrgUser(actor: AuthActor, orgId: string, input: CreateOrgUserInput) {
+    this.assertCanManageUsers(actor, orgId)
+    this.validateAssignment(input.role, input.managerAccess, input.shopId)
+    await this.validateShop(orgId, input.shopId)
+
+    const passwordHash = await bcrypt.hash(input.password, 10)
+
+    return this.prisma.$transaction(async tx => {
+      const user = await tx.user.create({
+        data: {
+          name: input.name,
+          email: input.email,
+          passwordHash,
+          role: input.role === 'STAFF' ? Role.STAFF : Role.MANAGER,
+          organizationId: orgId,
+          managerAccess: input.role === 'MANAGER'
+            ? input.managerAccess === 'ALL_SHOPS' ? ManagerAccess.ALL_SHOPS : ManagerAccess.ONE_SHOP
+            : null
+        }
+      })
+
+      if (input.shopId) {
+        await tx.shopStaff.create({
+          data: {
+            shopId: input.shopId,
+            userId: user.id,
+            role: input.role
+          }
+        })
+      }
+
+      return user
+    })
+  }
+
+  async listOrgUsers(actor: AuthActor, orgId: string) {
+    this.assertCanManageUsers(actor, orgId)
+
+    return this.prisma.user.findMany({
+      where: { organizationId: orgId },
+      include: { staffIn: { include: { shop: true } } }
+    })
+  }
+
+  async updateOrgUser(actor: AuthActor, orgId: string, userId: string, input: UpdateOrgUserInput) {
+    this.assertCanManageUsers(actor, orgId)
+
+    const existing = await this.prisma.user.findFirst({
+      where: { id: userId, organizationId: orgId },
+      include: { staffIn: { select: { shopId: true } } }
+    })
+    if (!existing) throw new Error('User not found in this organization')
+    if (existing.role !== Role.STAFF && existing.role !== Role.MANAGER) {
+      throw new Error('Only STAFF and MANAGER users can be updated by this service')
+    }
+
+    const role = input.role ?? existing.role
+    const managerAccess = role === Role.MANAGER
+      ? input.managerAccess ?? (existing.role === Role.MANAGER ? existing.managerAccess : undefined)
+      : input.managerAccess
+    const shopId = managerAccess === ManagerAccess.ALL_SHOPS
+      ? input.shopId
+      : input.shopId ?? existing.staffIn[0]?.shopId
+    this.validateAssignment(role, managerAccess, shopId)
+    await this.validateShop(orgId, shopId)
+
+    const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : undefined
+
+    return this.prisma.$transaction(async tx => {
+      const user = await tx.user.update({
+        where: { id: userId },
+        data: {
+          ...(input.name !== undefined && { name: input.name }),
+          ...(input.email !== undefined && { email: input.email }),
+          ...(passwordHash !== undefined && { passwordHash }),
+          role: role === 'STAFF' ? Role.STAFF : Role.MANAGER,
+          managerAccess: role === 'MANAGER'
+            ? managerAccess === 'ALL_SHOPS' ? ManagerAccess.ALL_SHOPS : ManagerAccess.ONE_SHOP
+            : null
+        }
+      })
+
+      await tx.shopStaff.deleteMany({ where: { userId } })
+      if (shopId) {
+        await tx.shopStaff.create({
+          data: {
+            shopId,
+            userId,
+            role
+          }
+        })
+      }
+
+      return user
+    })
+  }
+
+  async deactivateOrgUser(actor: AuthActor, orgId: string, userId: string) {
+    this.assertCanManageUsers(actor, orgId)
+
+    const existing = await this.prisma.user.findFirst({
+      where: { id: userId, organizationId: orgId }
+    })
+    if (!existing) throw new Error('User not found in this organization')
+
+    return this.prisma.user.update({
+      where: { id: userId },
+      data: { isActive: false }
+    })
+  }
+
+  private assertCanManageUsers(actor: AuthActor, orgId: string): void {
+    if (!canManageUsers(actor)) {
+      throw new Error('Insufficient permissions for user management')
+    }
+    if (actor.role === 'OWNER' && actor.organizationId !== orgId) {
+      throw new Error('Access denied to this organization')
+    }
+  }
+
+  private validateAssignment(role: UserRole, managerAccess: Access | null | undefined, shopId?: string): void {
+    if (role === 'STAFF') {
+      if (!shopId) throw new Error('shopId is required for STAFF')
+      if (managerAccess) throw new Error('managerAccess is not allowed for STAFF')
+      return
+    }
+
+    if (!managerAccess) throw new Error('managerAccess is required for MANAGER')
+    if (managerAccess === 'ONE_SHOP' && !shopId) {
+      throw new Error('shopId is required for ONE_SHOP managers')
+    }
+    if (managerAccess === 'ALL_SHOPS' && shopId) {
+      throw new Error('shopId is not allowed for ALL_SHOPS managers')
+    }
+  }
+
+  private async validateShop(orgId: string, shopId?: string): Promise<void> {
+    if (!shopId) return
+
+    const shop = await this.prisma.shop.findFirst({
+      where: { id: shopId, organizationId: orgId }
+    })
+    if (!shop) throw new Error('Shop not found in this organization')
+  }
+}
diff --git a/src/modules/organizations/types.ts b/src/modules/organizations/types.ts
index f40ff58..4cddba3 100644
--- a/src/modules/organizations/types.ts
+++ b/src/modules/organizations/types.ts
@@ -26,10 +26,28 @@ export interface LinkedUserResponse {
   name: string
   email: string
   role: string
   organizationId: string | null
 }
 
 export interface CreateOrganizationForUserResponse {
   organization: OrganizationResponse
   user: LinkedUserResponse
 }
+
+export type CreateOrgUserInput = {
+  name: string
+  email: string
+  password: string
+  role: 'STAFF' | 'MANAGER'
+  managerAccess?: 'ONE_SHOP' | 'ALL_SHOPS'
+  shopId?: string
+}
+
+export type UpdateOrgUserInput = {
+  name?: string
+  email?: string
+  password?: string
+  role?: 'STAFF' | 'MANAGER'
+  managerAccess?: 'ONE_SHOP' | 'ALL_SHOPS'
+  shopId?: string
+}
```
