# Final Branch Review Package (post-fix)
MERGE_BASE: a42bb9d026e4d212ffe4dad0b593d8c51e7e72f1
HEAD: 19747bdad3858a9d2cb38e6974ba81335892af49

## Commits
19747bd fix(auth): harden organization users and reports
bb48483 test(auth): verify role and shop scoping coverage
13b2d87 fix(auth): block STAFF/MANAGER on public register
4f0eaac docs(auth): document MANAGER role and tighten public register
8320e0c feat(cashflow): add org funding endpoint with manager ALL_SHOPS gate
49c9174 feat(auth): enforce role and shop scope on operational APIs
fe29c72 feat(auth): enforce shop scope on shop access and listings
27ac185 fix(auth): preserve STAFF/MANAGER on exchange and return shop scope
46cfa4b feat(org): expose OWNER user management HTTP APIs
105826e fix(org): require auth for listOrgUsers
add1312 feat(org): add owner-scoped user create/list/update/deactivate service
9299d8c feat(auth): add shop scope resolver and permission helpers
d0b0262 feat(auth): add MANAGER role and managerAccess to schema

## Stat
 .superpowers/sdd/final-fix-report.md               |  69 +++++
 .superpowers/sdd/task-10-report.md                 |  21 ++
 .../migration.sql                                  |  12 +
 prisma/schema.prisma                               |   7 +
 scripts/audit-multi-shop-staff.ts                  |  44 +++
 src/config/swagger.ts                              |   2 +-
 src/modules/auth/assertActor.test.ts               |  51 ++++
 src/modules/auth/assertActor.ts                    |  24 ++
 src/modules/auth/auth.controller.register.test.ts  |  43 +++
 src/modules/auth/auth.controller.ts                |   3 +-
 src/modules/auth/auth.middleware.ts                |  33 +--
 src/modules/auth/auth.service.exchange.test.ts     |  14 +
 src/modules/auth/auth.service.ts                   |  69 +++--
 src/modules/auth/auth.swagger.ts                   |   5 +-
 src/modules/auth/collectorResponse.ts              |   8 +-
 src/modules/auth/index.ts                          |   4 +-
 src/modules/auth/permissions.test.ts               |  52 ++++
 src/modules/auth/permissions.ts                    |  55 ++++
 src/modules/auth/shop-access.integration.test.ts   | 115 ++++++++
 src/modules/auth/shopScope.test.ts                 | 173 ++++++++++++
 src/modules/auth/shopScope.ts                      | 104 ++++++++
 src/modules/auth/types.ts                          |   3 +
 src/modules/cashflow/cashflow.service.ts           |  13 +
 src/modules/cashflow/funding.test.ts               |  44 +++
 src/modules/expense/expense.controller.ts          |  18 +-
 src/modules/expense/expense.service.ts             |   9 +-
 src/modules/expense/index.ts                       |   2 +-
 src/modules/inventory/index.ts                     |   2 +-
 src/modules/inventory/inventory.controller.ts      |  54 ++--
 src/modules/inventory/inventory.service.ts         |  24 +-
 src/modules/organizations/index.ts                 |  15 +-
 src/modules/organizations/org-users.controller.ts  | 133 ++++++++++
 .../organizations/org-users.service.test.ts        | 295 +++++++++++++++++++++
 src/modules/organizations/org-users.service.ts     | 184 +++++++++++++
 .../organization.controller.reports.test.ts        |  52 ++++
 .../organizations/organization.controller.ts       |  63 +++--
 src/modules/organizations/organization.swagger.ts  | 107 ++++++++
 src/modules/organizations/types.ts                 |  18 ++
 src/modules/purchase/index.ts                      |   2 +-
 src/modules/purchase/purchase.controller.ts        |  18 +-
 src/modules/purchase/purchase.service.ts           |   9 +-
 src/modules/receipt/receipt.controller.ts          |  48 +++-
 src/modules/sale/index.ts                          |   2 +-
 .../sale/sale.controller.permissions.test.ts       |  43 +++
 src/modules/sale/sale.controller.ts                |  27 +-
 src/modules/sale/sale.service.ts                   |   9 +-
 src/modules/shops/shop.controller.ts               |   8 +
 src/routes/auth.ts                                 |   7 +-
 src/routes/cashflow.ts                             |  56 +++-
 src/routes/organizations.ts                        |  28 +-
 src/routes/users.ts                                |   5 +-
 51 files changed, 2080 insertions(+), 126 deletions(-)

## Recent fix diff only
`diff
diff --git a/.superpowers/sdd/final-fix-report.md b/.superpowers/sdd/final-fix-report.md
new file mode 100644
index 0000000..81f0b1f
--- /dev/null
+++ b/.superpowers/sdd/final-fix-report.md
@@ -0,0 +1,69 @@
+# Final branch review fixes
+
+## Fix notes
+
+- Replaced organization-user response rows with an explicit Prisma selection that excludes `passwordHash` while retaining role, manager access, active status, and assigned shop data. Create, update, list, and deactivate responses now all use this response shape.
+- Restricted STAFF and ONE_SHOP MANAGER scope resolution to one deterministically selected assignment (lowest shop ID) if legacy data contains more than one `ShopStaff` row.
+- Applied report authorization to organization sales, expenses, purchases, stock, stock summary, and stock-transaction endpoints. STAFF is denied; ONE_SHOP managers must provide an in-scope `shopId`; all-shop roles retain organization-wide reports. Report service queries now apply the chosen shop scope in the database.
+- Added regression coverage for password-hash omission, multi-assignment staff scope collapse, and STAFF report denial.
+
+## Test output
+
+```text
+> agrovet@1.0.0 test
+> node --require ts-node/register --test "src/**/*.test.ts"
+
+Γ£ö loadAuthActor reads the active user authorization state from the database (4.989ms)
+Γ£ö loadAuthActor rejects inactive and missing users (2.1266ms)
+Γ£ö registerValidation rejects STAFF role (38.4344ms)
+Γ£ö registerValidation rejects MANAGER role (10.8797ms)
+Γ£ö registerValidation accepts OWNER role (5.5203ms)
+Γ£ö preserves STAFF and MANAGER local roles during Firebase exchange (4.6709ms)
+Γ£ö only OWNER (and platform admins) can manage users (5.9836ms)
+Γ£ö org funding allowed for OWNER and ALL_SHOPS manager only (10.2539ms)
+Γ£ö staff shop ops require shopInScope (20.208ms)
+Γ£ö manager can stock/purchase/report in scope (17.7118ms)
+Γ£ö requireShopAccess lets an owner access another shop in their organization (13.5191ms)
+Γ£ö ShopController.getAll limits staff to assigned shops (14.0254ms)
+Γ£ö OrganizationController.getShops limits one-shop managers to assigned shops (11.8479ms)
+Γ£ö STAFF scope is exactly assigned shop (6.3821ms)
+Γ£ö STAFF scope collapses multiple assignments to the first shop ID (59.0742ms)
+Γ£ö ONE_SHOP manager scope is exactly assigned shop (3.3431ms)
+Γ£ö ALL_SHOPS manager scope contains every organization shop (1.1389ms)
+Γ£ö OWNER scope contains every organization shop (0.8052ms)
+Γ£ö assertShopInScope rejects shops outside the assigned scope (2.1457ms)
+Γ£ö assertShopInScope rejects all-shop actors outside their organization (4.0097ms)
+Γ£ö recordFunding creates an IN adjustment with the default organization-funding note (6.3362ms)
+Γ£ö organization funding denies ONE_SHOP managers but allows ALL_SHOPS managers and owners (0.8015ms)
+Γ£ö deductSaleStock depletes the exact inventory row when inventoryId is provided (8.6291ms)
+Γ£ö deductSaleStock rejects inventory rows from another shop (8.5863ms)
+Γ£ö deductSaleStock rejects inventory rows with variant mismatch (0.8033ms)
+Γ£ö deductSaleStock rejects insufficient stock on an exact inventory row (1.6997ms)
+Γ£ö deductSaleStock still supports legacy variant plus batch resolution (1.4371ms)
+Γ£ö deductSaleStock accepts inventoryId together with variantId and ignores batch for row selection (5.7715ms)
+Γ£ö deductSaleStock rejects inventoryId payloads only when an explicit batch mismatches the row (9.8291ms)
+Γ£ö concurrent deductions against the same inventoryId only allow available stock once (2.8229ms)
+Γ£ö createOrgUser rejects STAFF without shopId (7.4629ms)
+Γ£ö createOrgUser creates STAFF with one ShopStaff assignment and no manager access (182.3377ms)
+Γ£ö createOrgUser rejects ALL_SHOPS manager with shopId (2.1539ms)
+Γ£ö createOrgUser rejects ONE_SHOP manager without shopId (0.8646ms)
+Γ£ö createOrgUser creates ALL_SHOPS manager without ShopStaff assignments (140.689ms)
+Γ£ö createOrgUser rejects actors without user-management permission (8.9291ms)
+Γ£ö createOrgUser rejects shops outside the organization (2.6585ms)
+Γ£ö updateOrgUser removes ShopStaff rows when switching to ALL_SHOPS (1.8349ms)
+Γ£ö listOrgUsers includes each user shop assignment and manager access (1.9166ms)
+Γ£ö listOrgUsers rejects actors without user-management permission (1.5807ms)
+Γ£ö deactivateOrgUser marks the organization user inactive (5.6136ms)
+Γ£ö STAFF receives 403 for organization sales reports (13.8078ms)
+Γ£ö createForSale keeps receipt numbers unique under concurrent requests (17.8398ms)
+Γ£ö createForSale retries automatically when a generated receipt number collides (1.3678ms)
+Γ£ö sale creation returns 403 when the shop is outside the actor scope (8.8699ms)
+Γä╣ tests 45
+Γä╣ suites 0
+Γä╣ pass 45
+Γä╣ fail 0
+Γä╣ cancelled 0
+Γä╣ skipped 0
+Γä╣ todo 0
+Γä╣ duration_ms 33897.6473
+```
diff --git a/src/modules/auth/shopScope.test.ts b/src/modules/auth/shopScope.test.ts
index cc9ac4f..8dc9363 100644
--- a/src/modules/auth/shopScope.test.ts
+++ b/src/modules/auth/shopScope.test.ts
@@ -47,16 +47,39 @@ test('STAFF scope is exactly assigned shop', async () => {
     role: 'STAFF',
     organizationId: 'org1'
   })
 
   assert.equal(scope.allShops, false)
   assert.deepEqual(scope.shopIds, ['s1'])
 })
 
+test('STAFF scope collapses multiple assignments to the first shop ID', async () => {
+  const prisma = createPrisma({
+    id: 'u1',
+    role: 'STAFF',
+    organizationId: 'org1',
+    managerAccess: null,
+    staffIn: [
+      { shop: { id: 's2', name: 'Branch' } },
+      { shop: { id: 's1', name: 'Main' } }
+    ],
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
 test('ONE_SHOP manager scope is exactly assigned shop', async () => {
   const prisma = createPrisma({
     id: 'u1',
     role: 'MANAGER',
     organizationId: 'org1',
     managerAccess: 'ONE_SHOP',
     staffIn: [{ shop: { id: 's1', name: 'Main' } }],
     shopsOwned: []
diff --git a/src/modules/auth/shopScope.ts b/src/modules/auth/shopScope.ts
index 9a57281..f12cc56 100644
--- a/src/modules/auth/shopScope.ts
+++ b/src/modules/auth/shopScope.ts
@@ -50,17 +50,28 @@ export async function resolveShopScope(prisma: Db, actor: AuthActor): Promise<Sh
         name: shop.name
       }))
     }
   }
 
   const fromStaff = user.staffIn.map((staff: { shop: { id: string; name: string } }) => ({
     shopId: staff.shop.id,
     name: staff.shop.name
-  }))
+  })).sort((left: { shopId: string }, right: { shopId: string }) =>
+    left.shopId.localeCompare(right.shopId)
+  )
+  const singleShopRole = user.role === 'STAFF' ||
+    (user.role === 'MANAGER' && user.managerAccess === 'ONE_SHOP')
+  if (singleShopRole) {
+    const shop = fromStaff[0]
+    return shop
+      ? { allShops: false, shopIds: [shop.shopId], shops: [shop] }
+      : { allShops: false, shopIds: [], shops: [] }
+  }
+
   const fromOwned = user.shopsOwned.map((shop: { id: string; name: string }) => ({
     shopId: shop.id,
     name: shop.name
   }))
   const uniqueShops = new Map<string, { shopId: string; name: string }>()
   for (const shop of [...fromOwned, ...fromStaff]) uniqueShops.set(shop.shopId, shop)
 
   const shops = [...uniqueShops.values()]
diff --git a/src/modules/expense/expense.service.ts b/src/modules/expense/expense.service.ts
index 9ccd7f1..570db20 100644
--- a/src/modules/expense/expense.service.ts
+++ b/src/modules/expense/expense.service.ts
@@ -44,19 +44,24 @@ export class ExpenseService {
 
   async getExpensesByShop(shopId: string) {
     return this.prisma.expense.findMany({
       where: { shopId },
       orderBy: { date: 'desc' }
     })
   }
 
-  async getExpensesByOrganization(organizationId: string) {
+  async getExpensesByOrganization(organizationId: string, shopIds?: string[]) {
     return this.prisma.expense.findMany({
-      where: { shop: { organizationId } },
+      where: {
+        shop: {
+          organizationId,
+          ...(shopIds ? { id: { in: shopIds } } : {})
+        }
+      },
       include: { shop: { select: { id: true, name: true } } },
       orderBy: { date: 'desc' }
     })
   }
 
   async getExpenseShop(shopId: string) {
     return this.prisma.shop.findUnique({
       where: { id: shopId },
diff --git a/src/modules/inventory/inventory.service.ts b/src/modules/inventory/inventory.service.ts
index daf73c5..8cf59fe 100644
--- a/src/modules/inventory/inventory.service.ts
+++ b/src/modules/inventory/inventory.service.ts
@@ -378,50 +378,60 @@ export class InventoryService {
 
   async getInventoryByShop(shopId: string) {
     return this.prisma.inventory.findMany({
       where: { shopId },
       include: { variant: { include: { product: true } } }
     })
   }
 
-  async getInventoryByOrganization(organizationId: string) {
+  async getInventoryByOrganization(organizationId: string, shopIds?: string[]) {
     return this.prisma.inventory.findMany({
-      where: { shop: { organizationId } },
+      where: {
+        shop: {
+          organizationId,
+          ...(shopIds ? { id: { in: shopIds } } : {})
+        }
+      },
       include: {
         shop: { select: { id: true, name: true, type: true, location: true } },
         variant: { include: { product: true } }
       },
       orderBy: { updatedAt: 'desc' }
     })
   }
 
   async getTransactionsByOrganization(
     organizationId: string,
-    filters: { shopId?: string; cursor?: string; take?: number } = {}
+    filters: { shopId?: string; shopIds?: string[]; cursor?: string; take?: number } = {}
   ) {
-    const { shopId, cursor, take = 50 } = filters
+    const { shopId, shopIds, cursor, take = 50 } = filters
 
     return this.prisma.inventoryTransaction.findMany({
       where: {
         shop: { organizationId },
-        ...(shopId ? { shopId } : {})
+        ...(shopId ? { shopId } : {}),
+        ...(shopIds ? { shopId: { in: shopIds } } : {})
       },
       take,
       ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
       orderBy: { createdAt: 'desc' },
       include: {
         shop: { select: { id: true, name: true } },
         variant: { include: { product: true } }
       }
     })
   }
 
-  async getStockSummaryByOrganization(organizationId: string, lowStockThreshold = 10) {
-    const rows = await this.getInventoryByOrganization(organizationId)
+  async getStockSummaryByOrganization(
+    organizationId: string,
+    lowStockThreshold = 10,
+    shopIds?: string[]
+  ) {
+    const rows = await this.getInventoryByOrganization(organizationId, shopIds)
 
     const byVariantMap = new Map<
       string,
       {
         variantId: string
         variantName: string
         sku: string
         productId: string
diff --git a/src/modules/organizations/org-users.service.test.ts b/src/modules/organizations/org-users.service.test.ts
index 828809b..c1e3ca4 100644
--- a/src/modules/organizations/org-users.service.test.ts
+++ b/src/modules/organizations/org-users.service.test.ts
@@ -30,31 +30,63 @@ function createPrismaFixture(shoppingOrganizationId = 'org-1') {
         const user = {
           id: `user-${users.length + 1}`,
           isActive: true,
           ...data
         }
         users.push(user)
         return user
       },
+      findUnique: async ({ where, select }: any) => {
+        const user = users.find(candidate => candidate.id === where.id)
+        if (!user) return null
+        if (!select) return user
+
+        return {
+          id: user.id,
+          name: user.name,
+          email: user.email,
+          role: user.role,
+          organizationId: user.organizationId,
+          managerAccess: user.managerAccess,
+          isActive: user.isActive,
+          staffIn: shopStaff
+            .filter(assignment => assignment.userId === user.id)
+            .map(assignment => ({
+              shopId: assignment.shopId,
+              role: assignment.role,
+              shop: shops.find(shop => shop.id === assignment.shopId)
+            }))
+        }
+      },
       findFirst: async ({ where }: any) =>
         users.find(user => user.id === where.id && user.organizationId === where.organizationId) ?? null,
       update: async ({ where, data }: any) => {
         const user = users.find(candidate => candidate.id === where.id)
         if (!user) throw new Error('User not found')
         Object.assign(user, data)
         return user
       },
-      findMany: async ({ where }: any) =>
+      findMany: async ({ where, select }: any) =>
         users.filter(user => user.organizationId === where.organizationId).map(user => ({
-          ...user,
+          ...(select
+            ? {
+                id: user.id,
+                name: user.name,
+                email: user.email,
+                role: user.role,
+                organizationId: user.organizationId,
+                managerAccess: user.managerAccess,
+                isActive: user.isActive
+              }
+            : user),
           staffIn: shopStaff
             .filter(assignment => assignment.userId === user.id)
             .map(assignment => ({
-              ...assignment,
+              ...(select ? { shopId: assignment.shopId, role: assignment.role } : assignment),
               shop: shops.find(shop => shop.id === assignment.shopId)
             }))
         }))
     },
     shopStaff: {
       create: async ({ data }: any) => {
         shopStaff.push(data)
         return data
@@ -110,16 +142,18 @@ test('createOrgUser rejects STAFF without shopId', async () => {
 test('createOrgUser creates STAFF with one ShopStaff assignment and no manager access', async () => {
   const fixture = createPrismaFixture()
   const service = new OrgUsersService(fixture.prisma as never)
 
   const user = await service.createOrgUser(owner, 'org-1', staffInput)
 
   assert.equal(user.role, 'STAFF')
   assert.equal(user.managerAccess, null)
+  assert.equal('passwordHash' in user, false)
+  assert.equal(user.staffIn[0]!.shop.id, 'shop-1')
   assert.deepEqual(fixture.shopStaff, [{ shopId: 'shop-1', userId: user.id, role: 'STAFF' }])
 })
 
 test('createOrgUser rejects ALL_SHOPS manager with shopId', async () => {
   const fixture = createPrismaFixture()
   const service = new OrgUsersService(fixture.prisma as never)
 
   await assert.rejects(
@@ -192,22 +226,23 @@ test('updateOrgUser removes ShopStaff rows when switching to ALL_SHOPS', async (
     role: 'MANAGER',
     organizationId: 'org-1',
     managerAccess: 'ONE_SHOP',
     isActive: true
   })
   fixture.shopStaff.push({ shopId: 'shop-1', userId: 'manager-1', role: 'MANAGER' })
   const service = new OrgUsersService(fixture.prisma as never)
 
-  await service.updateOrgUser(owner, 'org-1', 'manager-1', {
+  const user = await service.updateOrgUser(owner, 'org-1', 'manager-1', {
     role: 'MANAGER',
     managerAccess: 'ALL_SHOPS'
   })
 
   assert.equal(fixture.users[0]!.managerAccess, 'ALL_SHOPS')
+  assert.equal('passwordHash' in user, false)
   assert.deepEqual(fixture.shopStaff, [])
 })
 
 test('listOrgUsers includes each user shop assignment and manager access', async () => {
   const fixture = createPrismaFixture()
   fixture.users.push({
     id: 'staff-1',
     name: 'Staff',
@@ -220,16 +255,17 @@ test('listOrgUsers includes each user shop assignment and manager access', async
   })
   fixture.shopStaff.push({ shopId: 'shop-1', userId: 'staff-1', role: 'STAFF' })
   const service = new OrgUsersService(fixture.prisma as never)
 
   const users = await service.listOrgUsers(owner, 'org-1')
 
   assert.equal(users[0]!.managerAccess, null)
   assert.equal(users[0]!.staffIn[0]!.shop.id, 'shop-1')
+  assert.equal('passwordHash' in users[0]!, false)
 })
 
 test('listOrgUsers rejects actors without user-management permission', async () => {
   const fixture = createPrismaFixture()
   const service = new OrgUsersService(fixture.prisma as never)
 
   for (const actor of [
     { userId: 'staff-1', role: 'STAFF' as const, organizationId: 'org-1' },
diff --git a/src/modules/organizations/org-users.service.ts b/src/modules/organizations/org-users.service.ts
index 5c99f14..e84876a 100644
--- a/src/modules/organizations/org-users.service.ts
+++ b/src/modules/organizations/org-users.service.ts
@@ -1,16 +1,33 @@
 import bcrypt from 'bcrypt'
-import { ManagerAccess, PrismaClient, Role } from '@prisma/client'
+import { ManagerAccess, Prisma, PrismaClient, Role } from '@prisma/client'
 import { AuthActor, canManageUsers } from '../auth/permissions'
 import { CreateOrgUserInput, UpdateOrgUserInput } from './types'
 
 type UserRole = CreateOrgUserInput['role']
 type Access = NonNullable<CreateOrgUserInput['managerAccess']>
 
+const organizationUserSelect = {
+  id: true,
+  name: true,
+  email: true,
+  role: true,
+  organizationId: true,
+  managerAccess: true,
+  isActive: true,
+  staffIn: {
+    select: {
+      shopId: true,
+      role: true,
+      shop: { select: { id: true, name: true } }
+    }
+  }
+} satisfies Prisma.UserSelect
+
 export class OrgUsersService {
   constructor(private prisma: PrismaClient) {}
 
   async createOrgUser(actor: AuthActor, orgId: string, input: CreateOrgUserInput) {
     this.assertCanManageUsers(actor, orgId)
     this.validateAssignment(input.role, input.managerAccess, input.shopId)
     await this.validateShop(orgId, input.shopId)
 
@@ -35,26 +52,31 @@ export class OrgUsersService {
           data: {
             shopId: input.shopId,
             userId: user.id,
             role: input.role
           }
         })
       }
 
-      return user
+      const publicUser = await tx.user.findUnique({
+        where: { id: user.id },
+        select: organizationUserSelect
+      })
+      if (!publicUser) throw new Error('User not found after creation')
+      return publicUser
     })
   }
 
   async listOrgUsers(actor: AuthActor, orgId: string) {
     this.assertCanManageUsers(actor, orgId)
 
     return this.prisma.user.findMany({
       where: { organizationId: orgId },
-      include: { staffIn: { include: { shop: true } } }
+      select: organizationUserSelect
     })
   }
 
   async updateOrgUser(actor: AuthActor, orgId: string, userId: string, input: UpdateOrgUserInput) {
     this.assertCanManageUsers(actor, orgId)
 
     const existing = await this.prisma.user.findFirst({
       where: { id: userId, organizationId: orgId },
@@ -97,31 +119,37 @@ export class OrgUsersService {
           data: {
             shopId,
             userId,
             role
           }
         })
       }
 
-      return user
+      const publicUser = await tx.user.findUnique({
+        where: { id: user.id },
+        select: organizationUserSelect
+      })
+      if (!publicUser) throw new Error('User not found after update')
+      return publicUser
     })
   }
 
   async deactivateOrgUser(actor: AuthActor, orgId: string, userId: string) {
     this.assertCanManageUsers(actor, orgId)
 
     const existing = await this.prisma.user.findFirst({
       where: { id: userId, organizationId: orgId }
     })
     if (!existing) throw new Error('User not found in this organization')
 
     return this.prisma.user.update({
       where: { id: userId },
-      data: { isActive: false }
+      data: { isActive: false },
+      select: organizationUserSelect
     })
   }
 
   private assertCanManageUsers(actor: AuthActor, orgId: string): void {
     if (!canManageUsers(actor)) {
       throw new Error('Insufficient permissions for user management')
     }
     if (actor.role === 'OWNER' && actor.organizationId !== orgId) {
diff --git a/src/modules/organizations/organization.controller.reports.test.ts b/src/modules/organizations/organization.controller.reports.test.ts
new file mode 100644
index 0000000..6ddf904
--- /dev/null
+++ b/src/modules/organizations/organization.controller.reports.test.ts
@@ -0,0 +1,52 @@
+import assert from 'node:assert/strict'
+import test from 'node:test'
+import { OrganizationController } from './organization.controller'
+
+test('STAFF receives 403 for organization sales reports', async () => {
+  const prisma = {
+    organization: { findUnique: async () => ({ id: 'org-1' }) },
+    user: {
+      findUnique: async () => ({
+        id: 'staff-1',
+        role: 'STAFF',
+        organizationId: 'org-1',
+        managerAccess: null,
+        isActive: true,
+        staffIn: [{ shop: { id: 'shop-1', name: 'Assigned shop' } }],
+        shopsOwned: []
+      })
+    }
+  }
+  const controller = new OrganizationController(
+    {} as never,
+    {} as never,
+    prisma as never,
+    { getSalesByOrganization: async () => assert.fail('sales must not be loaded') } as never,
+    {} as never,
+    {} as never,
+    {} as never,
+    {} as never,
+    {} as never
+  )
+  let statusCode: number | undefined
+  let responseBody: unknown
+  const res = {
+    status(code: number) {
+      statusCode = code
+      return this
+    },
+    json(body: unknown) {
+      responseBody = body
+      return this
+    }
+  }
+
+  await controller.getSales({
+    params: { id: 'org-1' },
+    query: {},
+    user: { userId: 'staff-1', email: 'staff@example.com', role: 'STAFF' }
+  } as never, res as never)
+
+  assert.equal(statusCode, 403)
+  assert.deepEqual(responseBody, { error: 'Insufficient permissions to generate reports' })
+})
diff --git a/src/modules/organizations/organization.controller.ts b/src/modules/organizations/organization.controller.ts
index 08e3316..d2c18ee 100644
--- a/src/modules/organizations/organization.controller.ts
+++ b/src/modules/organizations/organization.controller.ts
@@ -8,17 +8,19 @@ import { NotificationService } from '../notifications/notification.service'
 import { PurchaseService } from '../purchase/purchase.service'
 import { SaleService } from '../sale/sale.service'
 import { InventoryService } from '../inventory/inventory.service'
 import { ShopService } from '../shops/shop.service'
 import { assertOrganizationAccess } from './organization-access'
 import { OrganizationService } from './organization.service'
 import { CreateOrganizationRequest } from './types'
 import { formatCollectorAuthResponse } from '../auth/collectorResponse'
-import { resolveShopScope } from '../auth/shopScope'
+import { assertShopInScope, resolveShopScope } from '../auth/shopScope'
+import { loadAuthActor } from '../auth/assertActor'
+import { canGenerateReports } from '../auth/permissions'
 
 export class OrganizationController {
   constructor(
     private organizationService: OrganizationService,
     private authService: AuthService,
     private prisma: PrismaClient,
     private saleService: SaleService,
     private expenseService: ExpenseService,
@@ -118,86 +120,89 @@ export class OrganizationController {
   ]
 
   stockSummaryValidation = [
     query('lowStockThreshold').optional().isInt({ min: 0 }).withMessage('lowStockThreshold must be >= 0')
   ]
 
   private orgErrorStatus(message: string): number {
     if (message === 'Organization not found') return 404
-    if (message === 'Access denied to this organization') return 403
+    if (message.includes('Access denied') || message.includes('Insufficient permissions')) return 403
     return 400
   }
 
   private async assertOrgAccess(req: AuthenticatedRequest, organizationId: string) {
     if (!req.user) {
       throw Object.assign(new Error('Authentication required'), { status: 401 })
     }
     await assertOrganizationAccess(this.prisma, req.user.userId, req.user.role, organizationId)
   }
 
+  private async getReportShopIds(req: AuthenticatedRequest): Promise<string[] | undefined> {
+    const actor = await loadAuthActor(this.prisma, req)
+    const shopId = req.query.shopId ? String(req.query.shopId) : undefined
+    if (!canGenerateReports(actor, { allShopsScope: !shopId })) {
+      throw Object.assign(new Error('Insufficient permissions to generate reports'), { status: 403 })
+    }
+    if (!shopId) return undefined
+
+    await assertShopInScope(this.prisma, actor, shopId)
+    return [shopId]
+  }
+
   getSales = async (req: AuthenticatedRequest, res: Response) => {
     try {
       if (!req.user) {
         return res.status(401).json({ error: 'Authentication required' })
       }
 
       const organizationId = String(req.params.id)
       await assertOrganizationAccess(this.prisma, req.user.userId, req.user.role, organizationId)
+      const shopIds = await this.getReportShopIds(req)
 
-      const sales = await this.saleService.getSalesByOrganization(organizationId)
+      const sales = await this.saleService.getSalesByOrganization(organizationId, shopIds)
       res.json({ data: sales })
     } catch (error: any) {
-      const status = error.message === 'Organization not found'
-        ? 404
-        : error.message === 'Access denied to this organization'
-          ? 403
-          : 400
+      const status = error.status ?? this.orgErrorStatus(error.message)
       res.status(status).json({ error: error.message })
     }
   }
 
   getExpenses = async (req: AuthenticatedRequest, res: Response) => {
     try {
       if (!req.user) {
         return res.status(401).json({ error: 'Authentication required' })
       }
 
       const organizationId = String(req.params.id)
       await assertOrganizationAccess(this.prisma, req.user.userId, req.user.role, organizationId)
+      const shopIds = await this.getReportShopIds(req)
 
-      const expenses = await this.expenseService.getExpensesByOrganization(organizationId)
+      const expenses = await this.expenseService.getExpensesByOrganization(organizationId, shopIds)
       res.json({ data: expenses })
     } catch (error: any) {
-      const status = error.message === 'Organization not found'
-        ? 404
-        : error.message === 'Access denied to this organization'
-          ? 403
-          : 400
+      const status = error.status ?? this.orgErrorStatus(error.message)
       res.status(status).json({ error: error.message })
     }
   }
 
   getPurchases = async (req: AuthenticatedRequest, res: Response) => {
     try {
       if (!req.user) {
         return res.status(401).json({ error: 'Authentication required' })
       }
 
       const organizationId = String(req.params.id)
       await assertOrganizationAccess(this.prisma, req.user.userId, req.user.role, organizationId)
+      const shopIds = await this.getReportShopIds(req)
 
-      const purchases = await this.purchaseService.getPurchasesByOrganization(organizationId)
+      const purchases = await this.purchaseService.getPurchasesByOrganization(organizationId, shopIds)
       res.json({ data: purchases })
     } catch (error: any) {
-      const status = error.message === 'Organization not found'
-        ? 404
-        : error.message === 'Access denied to this organization'
-          ? 403
-          : 400
+      const status = error.status ?? this.orgErrorStatus(error.message)
       res.status(status).json({ error: error.message })
     }
   }
 
   getNotifications = async (req: AuthenticatedRequest, res: Response) => {
     try {
       const errors = validationResult(req)
       if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
@@ -233,56 +238,64 @@ export class OrganizationController {
       res.status(status).json({ error: error.message })
     }
   }
 
   getStock = async (req: AuthenticatedRequest, res: Response) => {
     try {
       const organizationId = String(req.params.id)
       await this.assertOrgAccess(req, organizationId)
+      const shopIds = await this.getReportShopIds(req)
 
-      const stock = await this.inventoryService.getInventoryByOrganization(organizationId)
+      const stock = await this.inventoryService.getInventoryByOrganization(organizationId, shopIds)
       res.json({ data: stock })
     } catch (error: any) {
       const status = error.status ?? this.orgErrorStatus(error.message)
       res.status(status).json({ error: error.message })
     }
   }
 
   getStockSummary = async (req: AuthenticatedRequest, res: Response) => {
     try {
       const errors = validationResult(req)
       if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
 
       const organizationId = String(req.params.id)
       await this.assertOrgAccess(req, organizationId)
+      const shopIds = await this.getReportShopIds(req)
 
       const threshold = req.query.lowStockThreshold !== undefined
         ? Number(req.query.lowStockThreshold)
         : 10
 
-      const summary = await this.inventoryService.getStockSummaryByOrganization(organizationId, threshold)
+      const summary = await this.inventoryService.getStockSummaryByOrganization(
+        organizationId,
+        threshold,
+        shopIds
+      )
       res.json({ data: summary })
     } catch (error: any) {
       const status = error.status ?? this.orgErrorStatus(error.message)
       res.status(status).json({ error: error.message })
     }
   }
 
   getStockTransactions = async (req: AuthenticatedRequest, res: Response) => {
     try {
       const errors = validationResult(req)
       if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
 
       const organizationId = String(req.params.id)
       await this.assertOrgAccess(req, organizationId)
+      const shopIds = await this.getReportShopIds(req)
 
       const limit = req.query.limit ? Number(req.query.limit) : 50
       const transactions = await this.inventoryService.getTransactionsByOrganization(organizationId, {
         ...(req.query.shopId ? { shopId: String(req.query.shopId) } : {}),
+        ...(shopIds ? { shopIds } : {}),
         ...(req.query.cursor ? { cursor: String(req.query.cursor) } : {}),
         take: limit
       })
 
       res.json({ data: transactions })
     } catch (error: any) {
       const status = error.status ?? this.orgErrorStatus(error.message)
       res.status(status).json({ error: error.message })
diff --git a/src/modules/purchase/purchase.service.ts b/src/modules/purchase/purchase.service.ts
index d5b8986..ebbb394 100644
--- a/src/modules/purchase/purchase.service.ts
+++ b/src/modules/purchase/purchase.service.ts
@@ -109,19 +109,24 @@ export class PurchaseService {
             }
           }
         }
       },
       orderBy: { createdAt: 'desc' }
     })
   }
 
-  async getPurchasesByOrganization(organizationId: string) {
+  async getPurchasesByOrganization(organizationId: string, shopIds?: string[]) {
     return this.prisma.purchase.findMany({
-      where: { shop: { organizationId } },
+      where: {
+        shop: {
+          organizationId,
+          ...(shopIds ? { id: { in: shopIds } } : {})
+        }
+      },
       include: {
         shop: { select: { id: true, name: true } },
         supplier: true,
         items: {
           include: {
             variant: {
               include: { product: true }
             }
diff --git a/src/modules/sale/sale.service.ts b/src/modules/sale/sale.service.ts
index 8052d28..6d2db21 100644
--- a/src/modules/sale/sale.service.ts
+++ b/src/modules/sale/sale.service.ts
@@ -200,19 +200,24 @@ export class SaleService {
 
   async getSaleShop(shopId: string) {
     return this.prisma.shop.findUnique({
       where: { id: shopId },
       select: { id: true, name: true }
     })
   }
 
-  async getSalesByOrganization(organizationId: string) {
+  async getSalesByOrganization(organizationId: string, shopIds?: string[]) {
     return this.prisma.sale.findMany({
-      where: { shop: { organizationId } },
+      where: {
+        shop: {
+          organizationId,
+          ...(shopIds ? { id: { in: shopIds } } : {})
+        }
+      },
       include: {
         shop: { select: { id: true, name: true } },
         items: { include: { variant: { include: { product: true } } } },
         payments: true
       },
       orderBy: { createdAt: 'desc' }
     })
   }
```
