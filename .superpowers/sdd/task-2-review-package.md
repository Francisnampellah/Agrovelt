# Review Package Task 2
BASE: d0b0262f88b28aab28c55fee4590f25b30b1a86b
HEAD: 9299d8c64027c471a60bf0f9d3022aa269964aa9

## Commits
9299d8c feat(auth): add shop scope resolver and permission helpers

## Stat
 src/modules/auth/index.ts            |   4 +-
 src/modules/auth/permissions.test.ts |  52 ++++++++++++
 src/modules/auth/permissions.ts      |  55 +++++++++++++
 src/modules/auth/shopScope.test.ts   | 150 +++++++++++++++++++++++++++++++++++
 src/modules/auth/shopScope.ts        |  93 ++++++++++++++++++++++
 5 files changed, 353 insertions(+), 1 deletion(-)

## Diff
```diff
diff --git a/src/modules/auth/index.ts b/src/modules/auth/index.ts
index fb4d63a..f0360c0 100644
--- a/src/modules/auth/index.ts
+++ b/src/modules/auth/index.ts
@@ -1,4 +1,6 @@
 export { AuthService } from './auth.service'
 export { AuthController } from './auth.controller'
 export { AuthMiddleware } from './auth.middleware'
-export * from './types'
\ No newline at end of file
+export * from './types'
+export * from './permissions'
+export * from './shopScope'
\ No newline at end of file
diff --git a/src/modules/auth/permissions.test.ts b/src/modules/auth/permissions.test.ts
new file mode 100644
index 0000000..c46ec00
--- /dev/null
+++ b/src/modules/auth/permissions.test.ts
@@ -0,0 +1,52 @@
+import test from 'node:test'
+import assert from 'node:assert/strict'
+import {
+  canManageUsers,
+  canAddOrgFunding,
+  canAddStock,
+  canPurchase,
+  canGenerateReports,
+  canSell,
+  canRefund,
+  canAddExpense,
+  canViewShopFinance,
+  canDownloadReceipt
+} from './permissions'
+
+test('only OWNER (and platform admins) can manage users', () => {
+  assert.equal(canManageUsers({ userId: '1', role: 'OWNER' }), true)
+  assert.equal(canManageUsers({ userId: '1', role: 'ADMIN' }), true)
+  assert.equal(canManageUsers({ userId: '1', role: 'SUPER_ADMIN' }), true)
+  assert.equal(canManageUsers({ userId: '1', role: 'MANAGER', managerAccess: 'ALL_SHOPS' }), false)
+  assert.equal(canManageUsers({ userId: '1', role: 'STAFF' }), false)
+})
+
+test('org funding allowed for OWNER and ALL_SHOPS manager only', () => {
+  assert.equal(canAddOrgFunding({ userId: '1', role: 'OWNER' }), true)
+  assert.equal(canAddOrgFunding({ userId: '1', role: 'MANAGER', managerAccess: 'ALL_SHOPS' }), true)
+  assert.equal(canAddOrgFunding({ userId: '1', role: 'MANAGER', managerAccess: 'ONE_SHOP' }), false)
+  assert.equal(canAddOrgFunding({ userId: '1', role: 'STAFF' }), false)
+})
+
+test('staff shop ops require shopInScope', () => {
+  const staff = { userId: '1', role: 'STAFF' }
+  assert.equal(canSell(staff, true), true)
+  assert.equal(canSell(staff, false), false)
+  assert.equal(canRefund(staff, true), true)
+  assert.equal(canAddExpense(staff, true), true)
+  assert.equal(canViewShopFinance(staff, true), true)
+  assert.equal(canDownloadReceipt(staff, true), true)
+  assert.equal(canAddStock(staff, true), false)
+  assert.equal(canPurchase(staff, true), false)
+  assert.equal(canGenerateReports(staff, { allShopsScope: false }), false)
+})
+
+test('manager can stock/purchase/report in scope', () => {
+  const one = { userId: '1', role: 'MANAGER', managerAccess: 'ONE_SHOP' as const }
+  const all = { userId: '1', role: 'MANAGER', managerAccess: 'ALL_SHOPS' as const }
+  assert.equal(canAddStock(one, true), true)
+  assert.equal(canAddStock(one, false), false)
+  assert.equal(canPurchase(all, true), true)
+  assert.equal(canGenerateReports(one, { allShopsScope: false }), true)
+  assert.equal(canGenerateReports(all, { allShopsScope: true }), true)
+})
diff --git a/src/modules/auth/permissions.ts b/src/modules/auth/permissions.ts
new file mode 100644
index 0000000..51ccea9
--- /dev/null
+++ b/src/modules/auth/permissions.ts
@@ -0,0 +1,55 @@
+export type AuthActor = {
+  userId: string
+  role: string
+  organizationId?: string | null
+  managerAccess?: 'ONE_SHOP' | 'ALL_SHOPS' | null
+}
+
+function isPlatformAdmin(actor: AuthActor): boolean {
+  return actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN'
+}
+
+export function canManageUsers(actor: AuthActor): boolean {
+  return actor.role === 'OWNER' || isPlatformAdmin(actor)
+}
+
+export function canAddOrgFunding(actor: AuthActor): boolean {
+  if (actor.role === 'OWNER' || isPlatformAdmin(actor)) return true
+  return actor.role === 'MANAGER' && actor.managerAccess === 'ALL_SHOPS'
+}
+
+export function canAddStock(actor: AuthActor, shopInScope: boolean): boolean {
+  if (!shopInScope) return false
+  if (actor.role === 'OWNER' || isPlatformAdmin(actor)) return true
+  return actor.role === 'MANAGER'
+}
+
+export function canPurchase(actor: AuthActor, shopInScope: boolean): boolean {
+  return canAddStock(actor, shopInScope)
+}
+
+export function canGenerateReports(
+  actor: AuthActor,
+  opts: { allShopsScope: boolean }
+): boolean {
+  if (actor.role === 'OWNER' || isPlatformAdmin(actor)) return true
+  if (actor.role !== 'MANAGER') return false
+  if (actor.managerAccess === 'ALL_SHOPS') return true
+  return !opts.allShopsScope
+}
+
+function shopOpsAllowed(actor: AuthActor, shopInScope: boolean): boolean {
+  if (!shopInScope) return false
+  return (
+    actor.role === 'OWNER' ||
+    actor.role === 'MANAGER' ||
+    actor.role === 'STAFF' ||
+    isPlatformAdmin(actor)
+  )
+}
+
+export const canSell = shopOpsAllowed
+export const canRefund = shopOpsAllowed
+export const canAddExpense = shopOpsAllowed
+export const canViewShopFinance = shopOpsAllowed
+export const canDownloadReceipt = shopOpsAllowed
diff --git a/src/modules/auth/shopScope.test.ts b/src/modules/auth/shopScope.test.ts
new file mode 100644
index 0000000..cc9ac4f
--- /dev/null
+++ b/src/modules/auth/shopScope.test.ts
@@ -0,0 +1,150 @@
+import test from 'node:test'
+import assert from 'node:assert/strict'
+import { assertShopInScope, resolveShopScope } from './shopScope'
+
+type UserRecord = {
+  id: string
+  role: string
+  organizationId: string | null
+  managerAccess: 'ONE_SHOP' | 'ALL_SHOPS' | null
+  staffIn: { shop: { id: string; name: string } }[]
+  shopsOwned: { id: string; name: string }[]
+}
+
+function createPrisma(user: UserRecord, shops = [
+  { id: 's1', name: 'Main', organizationId: 'org1' },
+  { id: 's2', name: 'Branch', organizationId: 'org1' },
+  { id: 's3', name: 'Other', organizationId: 'org2' }
+]) {
+  return {
+    user: {
+      findUnique: async () => user
+    },
+    shop: {
+      findMany: async ({ where }: { where: { organizationId: string } }) =>
+        shops
+          .filter(shop => shop.organizationId === where.organizationId)
+          .sort((left, right) => left.name.localeCompare(right.name))
+          .map(({ id, name }) => ({ id, name })),
+      findUnique: async ({ where }: { where: { id: string } }) =>
+        shops.find(shop => shop.id === where.id) ?? null
+    }
+  }
+}
+
+test('STAFF scope is exactly assigned shop', async () => {
+  const prisma = createPrisma({
+    id: 'u1',
+    role: 'STAFF',
+    organizationId: 'org1',
+    managerAccess: null,
+    staffIn: [{ shop: { id: 's1', name: 'Main' } }],
+    shopsOwned: []
+  })
+
+  const scope = await resolveShopScope(prisma as never, {
+    userId: 'u1',
+    role: 'STAFF',
+    organizationId: 'org1'
+  })
+
+  assert.equal(scope.allShops, false)
+  assert.deepEqual(scope.shopIds, ['s1'])
+})
+
+test('ONE_SHOP manager scope is exactly assigned shop', async () => {
+  const prisma = createPrisma({
+    id: 'u1',
+    role: 'MANAGER',
+    organizationId: 'org1',
+    managerAccess: 'ONE_SHOP',
+    staffIn: [{ shop: { id: 's1', name: 'Main' } }],
+    shopsOwned: []
+  })
+
+  const scope = await resolveShopScope(prisma as never, {
+    userId: 'u1',
+    role: 'MANAGER',
+    organizationId: 'org1',
+    managerAccess: 'ONE_SHOP'
+  })
+
+  assert.equal(scope.allShops, false)
+  assert.deepEqual(scope.shopIds, ['s1'])
+})
+
+test('ALL_SHOPS manager scope contains every organization shop', async () => {
+  const prisma = createPrisma({
+    id: 'u1',
+    role: 'MANAGER',
+    organizationId: 'org1',
+    managerAccess: 'ALL_SHOPS',
+    staffIn: [],
+    shopsOwned: []
+  })
+
+  const scope = await resolveShopScope(prisma as never, {
+    userId: 'u1',
+    role: 'MANAGER',
+    organizationId: 'org1',
+    managerAccess: 'ALL_SHOPS'
+  })
+
+  assert.equal(scope.allShops, true)
+  assert.deepEqual(scope.shopIds, ['s2', 's1'])
+})
+
+test('OWNER scope contains every organization shop', async () => {
+  const prisma = createPrisma({
+    id: 'u1',
+    role: 'OWNER',
+    organizationId: 'org1',
+    managerAccess: null,
+    staffIn: [],
+    shopsOwned: [{ id: 's1', name: 'Main' }]
+  })
+
+  const scope = await resolveShopScope(prisma as never, {
+    userId: 'u1',
+    role: 'OWNER',
+    organizationId: 'org1'
+  })
+
+  assert.equal(scope.allShops, true)
+  assert.deepEqual(scope.shopIds, ['s2', 's1'])
+})
+
+test('assertShopInScope rejects shops outside the assigned scope', async () => {
+  const prisma = createPrisma({
+    id: 'u1',
+    role: 'STAFF',
+    organizationId: 'org1',
+    managerAccess: null,
+    staffIn: [{ shop: { id: 's1', name: 'Main' } }],
+    shopsOwned: []
+  })
+
+  await assert.rejects(
+    assertShopInScope(prisma as never, { userId: 'u1', role: 'STAFF', organizationId: 'org1' }, 's2'),
+    /Access denied to this shop/
+  )
+})
+
+test('assertShopInScope rejects all-shop actors outside their organization', async () => {
+  for (const actor of [
+    { userId: 'u1', role: 'MANAGER', organizationId: 'org1', managerAccess: 'ALL_SHOPS' as const },
+    { userId: 'u1', role: 'OWNER', organizationId: 'org1' }
+  ]) {
+    const prisma = createPrisma({
+      id: 'u1',
+      role: actor.role,
+      organizationId: 'org1',
+      managerAccess: actor.managerAccess ?? null,
+      staffIn: [],
+      shopsOwned: []
+    })
+
+    await assert.doesNotReject(assertShopInScope(prisma as never, actor, 's1'))
+    await assert.rejects(assertShopInScope(prisma as never, actor, 's3'), /Access denied to this shop/)
+  }
+})
diff --git a/src/modules/auth/shopScope.ts b/src/modules/auth/shopScope.ts
new file mode 100644
index 0000000..9a57281
--- /dev/null
+++ b/src/modules/auth/shopScope.ts
@@ -0,0 +1,93 @@
+import { PrismaClient } from '@prisma/client'
+import { AuthActor } from './permissions'
+
+export type ShopScopeResult = {
+  allShops: boolean
+  shopIds: string[]
+  shops: { shopId: string; name: string }[]
+}
+
+type Db = PrismaClient | any
+
+export async function resolveShopScope(prisma: Db, actor: AuthActor): Promise<ShopScopeResult> {
+  if (actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN') {
+    return { allShops: true, shopIds: [], shops: [] }
+  }
+
+  const user = await prisma.user.findUnique({
+    where: { id: actor.userId },
+    select: {
+      role: true,
+      organizationId: true,
+      managerAccess: true,
+      shopsOwned: { select: { id: true, name: true } },
+      staffIn: { select: { shop: { select: { id: true, name: true } } }
+      }
+    }
+  })
+  if (!user) throw new Error('User not found')
+
+  const allShopsAccess =
+    user.role === 'OWNER' ||
+    (user.role === 'MANAGER' && user.managerAccess === 'ALL_SHOPS')
+
+  if (allShopsAccess) {
+    if (!user.organizationId) {
+      return { allShops: true, shopIds: [], shops: [] }
+    }
+
+    const orgShops = await prisma.shop.findMany({
+      where: { organizationId: user.organizationId },
+      select: { id: true, name: true },
+      orderBy: { name: 'asc' }
+    })
+
+    return {
+      allShops: true,
+      shopIds: orgShops.map((shop: { id: string }) => shop.id),
+      shops: orgShops.map((shop: { id: string; name: string }) => ({
+        shopId: shop.id,
+        name: shop.name
+      }))
+    }
+  }
+
+  const fromStaff = user.staffIn.map((staff: { shop: { id: string; name: string } }) => ({
+    shopId: staff.shop.id,
+    name: staff.shop.name
+  }))
+  const fromOwned = user.shopsOwned.map((shop: { id: string; name: string }) => ({
+    shopId: shop.id,
+    name: shop.name
+  }))
+  const uniqueShops = new Map<string, { shopId: string; name: string }>()
+  for (const shop of [...fromOwned, ...fromStaff]) uniqueShops.set(shop.shopId, shop)
+
+  const shops = [...uniqueShops.values()]
+  return { allShops: false, shopIds: shops.map(shop => shop.shopId), shops }
+}
+
+export async function assertShopInScope(prisma: Db, actor: AuthActor, shopId: string): Promise<void> {
+  if (actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN') return
+
+  const scope = await resolveShopScope(prisma, actor)
+  if (scope.allShops) {
+    const [user, shop] = await Promise.all([
+      prisma.user.findUnique({
+        where: { id: actor.userId },
+        select: { organizationId: true }
+      }),
+      prisma.shop.findUnique({
+        where: { id: shopId },
+        select: { organizationId: true }
+      })
+    ])
+
+    if (user?.organizationId && shop?.organizationId === user.organizationId) return
+    throw new Error('Access denied to this shop')
+  }
+
+  if (!scope.shopIds.includes(shopId)) {
+    throw new Error('Access denied to this shop')
+  }
+}
```
