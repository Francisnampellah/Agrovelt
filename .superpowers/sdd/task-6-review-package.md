# Review Package Task 6
BASE: 27ac185d0820a967b6ff6a4109c31d700feaf2e6
HEAD: fe29c72ed7839a6a98d477711e583f0e2081a538

## Commits
fe29c72 feat(auth): enforce shop scope on shop access and listings

## Stat
 src/modules/auth/auth.middleware.ts                |  33 +++---
 src/modules/auth/shop-access.integration.test.ts   | 115 +++++++++++++++++++++
 .../organizations/organization.controller.ts       |   8 ++
 src/modules/shops/shop.controller.ts               |   8 ++
 4 files changed, 144 insertions(+), 20 deletions(-)

## Diff
```diff
diff --git a/src/modules/auth/auth.middleware.ts b/src/modules/auth/auth.middleware.ts
index 3424139..9d62166 100644
--- a/src/modules/auth/auth.middleware.ts
+++ b/src/modules/auth/auth.middleware.ts
@@ -1,15 +1,17 @@
 import { Request, Response, NextFunction } from 'express'
 import { AuthService } from './auth.service'
 import { firebaseAuth } from '../../config/firebase'
 import { AuthenticatedRequest, JWTPayload } from './types'
 import { normalizeAgrovetExchangeGlobalRole } from './firebaseRoleMapping'
+import { assertShopInScope } from './shopScope'
+import { AuthActor } from './permissions'
 
 export class AuthMiddleware {
   // Define public routes that don't require authentication
   private publicRoutes = [
     '/health',
     '/api/auth/register',
     '/api/auth/login',
     '/api/auth/exchange',
     '/api/auth/refresh-token',
     '/api-docs'
@@ -110,48 +112,39 @@ export class AuthMiddleware {
       if (!req.user) {
         return res.status(401).json({ error: 'Authentication required' })
       }
 
       const shopId = req.params?.shopId || req.body?.shopId || req.query?.shopId
 
       if (!shopId) {
         return res.status(400).json({ error: 'Shop ID required' })
       }
 
-      // Admin can access all shops
-      if (req.user.role === 'ADMIN') {
+      if (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN') {
         return next()
       }
 
-      // Check if user owns the shop or is staff
-      const shop = await this.authService['prisma'].shop.findUnique({
-        where: { id: shopId as string },
-        select: {
-          ownerId: true,
-          staff: {
-            where: { userId: req.user.userId },
-            select: { id: true }
-          }
-        }
+      const user = await this.authService['prisma'].user.findUnique({
+        where: { id: req.user.userId },
+        select: { managerAccess: true }
       })
-
-      if (!shop) {
-        return res.status(404).json({ error: 'Shop not found' })
-      }
-
-      if (shop.ownerId !== req.user.userId && shop.staff.length === 0) {
-        return res.status(403).json({ error: 'Access denied to this shop' })
+      const actor: AuthActor = {
+        userId: req.user.userId,
+        role: req.user.role,
+        ...(req.user.organizationId ? { organizationId: req.user.organizationId } : {}),
+        ...(user?.managerAccess ? { managerAccess: user.managerAccess } : {})
       }
+      await assertShopInScope(this.authService['prisma'], actor, String(shopId))
 
       next()
     } catch (error) {
-      return res.status(500).json({ error: 'Authorization check failed' })
+      return res.status(403).json({ error: 'Access denied to this shop' })
     }
   }
 
   logActivity = (action: string, entity: string) => {
     return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
       const authService = this.authService
       const originalSend = res.send
 
       res.send = function(data: any) {
         // Log activity after response
diff --git a/src/modules/auth/shop-access.integration.test.ts b/src/modules/auth/shop-access.integration.test.ts
new file mode 100644
index 0000000..4427768
--- /dev/null
+++ b/src/modules/auth/shop-access.integration.test.ts
@@ -0,0 +1,115 @@
+import test from 'node:test'
+import assert from 'node:assert/strict'
+import { AuthMiddleware } from './auth.middleware'
+import { ShopController } from '../shops/shop.controller'
+import { OrganizationController } from '../organizations/organization.controller'
+
+const assignedShop = { id: 'shop-1', name: 'Assigned' }
+const otherShop = { id: 'shop-2', name: 'Other' }
+
+function createResponse() {
+  const response = {
+    statusCode: 200,
+    body: undefined as unknown,
+    status(code: number) {
+      response.statusCode = code
+      return response
+    },
+    json(body: unknown) {
+      response.body = body
+      return response
+    }
+  }
+
+  return response
+}
+
+function scopedUser(role: string, managerAccess: 'ONE_SHOP' | 'ALL_SHOPS' | null = null) {
+  return {
+    id: 'user-1',
+    role,
+    organizationId: 'org-1',
+    managerAccess,
+    isActive: true,
+    staffIn: [{ shop: assignedShop }],
+    shopsOwned: []
+  }
+}
+
+test('requireShopAccess lets an owner access another shop in their organization', async () => {
+  const prisma = {
+    user: { findUnique: async () => scopedUser('OWNER') },
+    shop: {
+      findMany: async () => [assignedShop, otherShop],
+      findUnique: async () => ({ organizationId: 'org-1', ownerId: 'another-user', staff: [] })
+    }
+  }
+  const middleware = new AuthMiddleware({ prisma } as never)
+  const response = createResponse()
+  let proceeded = false
+
+  await middleware.requireShopAccess(
+    { user: { userId: 'user-1', role: 'OWNER', organizationId: 'org-1' }, params: { shopId: 'shop-2' } } as never,
+    response as never,
+    () => { proceeded = true }
+  )
+
+  assert.equal(proceeded, true)
+  assert.equal(response.statusCode, 200)
+})
+
+test('ShopController.getAll limits staff to assigned shops', async () => {
+  const prisma = {
+    user: { findUnique: async () => scopedUser('STAFF') },
+    shop: { findMany: async () => [assignedShop, otherShop] }
+  }
+  const controller = new ShopController({
+    prisma,
+    getAllShops: async () => [assignedShop, otherShop]
+  } as never)
+  const response = createResponse()
+
+  await controller.getAll(
+    { user: { userId: 'user-1', role: 'STAFF', organizationId: 'org-1' } } as never,
+    response as never
+  )
+
+  assert.deepEqual(response.body, { data: [assignedShop] })
+})
+
+test('OrganizationController.getShops limits one-shop managers to assigned shops', async () => {
+  const prisma = {
+    organization: { findUnique: async () => ({ id: 'org-1' }) },
+    user: { findUnique: async () => scopedUser('MANAGER', 'ONE_SHOP') },
+    shop: { findMany: async () => [assignedShop, otherShop] }
+  }
+  const controller = new OrganizationController(
+    {} as never,
+    {} as never,
+    prisma as never,
+    {} as never,
+    {} as never,
+    {} as never,
+    {} as never,
+    {} as never,
+    {
+      getAllShops: async () => [assignedShop, otherShop]
+    } as never
+  )
+  const response = createResponse()
+
+  await controller.getShops(
+    {
+      user: {
+        userId: 'user-1',
+        role: 'MANAGER',
+        organizationId: 'org-1',
+        managerAccess: 'ONE_SHOP'
+      },
+      params: { id: 'org-1' }
+    } as never,
+    response as never
+  )
+
+  assert.deepEqual(response.body, { data: [assignedShop] })
+})
diff --git a/src/modules/organizations/organization.controller.ts b/src/modules/organizations/organization.controller.ts
index a2ac9bc..08e3316 100644
--- a/src/modules/organizations/organization.controller.ts
+++ b/src/modules/organizations/organization.controller.ts
@@ -6,20 +6,21 @@ import { AuthService } from '../auth/auth.service'
 import { ExpenseService } from '../expense/expense.service'
 import { NotificationService } from '../notifications/notification.service'
 import { PurchaseService } from '../purchase/purchase.service'
 import { SaleService } from '../sale/sale.service'
 import { InventoryService } from '../inventory/inventory.service'
 import { ShopService } from '../shops/shop.service'
 import { assertOrganizationAccess } from './organization-access'
 import { OrganizationService } from './organization.service'
 import { CreateOrganizationRequest } from './types'
 import { formatCollectorAuthResponse } from '../auth/collectorResponse'
+import { resolveShopScope } from '../auth/shopScope'
 
 export class OrganizationController {
   constructor(
     private organizationService: OrganizationService,
     private authService: AuthService,
     private prisma: PrismaClient,
     private saleService: SaleService,
     private expenseService: ExpenseService,
     private purchaseService: PurchaseService,
     private notificationService: NotificationService,
@@ -212,20 +213,27 @@ export class OrganizationController {
       res.status(status).json({ error: error.message })
     }
   }
 
   getShops = async (req: AuthenticatedRequest, res: Response) => {
     try {
       const organizationId = String(req.params.id)
       await this.assertOrgAccess(req, organizationId)
 
       const shops = await this.shopService.getAllShops(organizationId)
+      if (req.user && (req.user.role === 'STAFF' || req.user.role === 'MANAGER')) {
+        const scope = await resolveShopScope(this.prisma, req.user)
+        if (!scope.allShops) {
+          return res.json({ data: shops.filter(shop => scope.shopIds.includes(shop.id)) })
+        }
+      }
+
       res.json({ data: shops })
     } catch (error: any) {
       const status = error.status ?? this.orgErrorStatus(error.message)
       res.status(status).json({ error: error.message })
     }
   }
 
   getStock = async (req: AuthenticatedRequest, res: Response) => {
     try {
       const organizationId = String(req.params.id)
diff --git a/src/modules/shops/shop.controller.ts b/src/modules/shops/shop.controller.ts
index 6e077c1..80cac22 100644
--- a/src/modules/shops/shop.controller.ts
+++ b/src/modules/shops/shop.controller.ts
@@ -1,15 +1,16 @@
 import { Request, Response } from 'express'
 import { body, validationResult } from 'express-validator'
 import { ShopService } from './shop.service'
 import { CreateShopRequest, UpdateShopRequest } from './types'
 import { AuthenticatedRequest } from '../auth/types'
+import { resolveShopScope } from '../auth/shopScope'
 
 export class ShopController {
   constructor(private shopService: ShopService) {}
 
   // Validation rules
   createShopValidation = [
     body('name').trim().notEmpty().withMessage('Shop name is required')
       .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
     body('location').optional().trim().isLength({ max: 255 }).withMessage('Location too long'),
     body('ownerId').notEmpty().isUUID().withMessage('Valid owner ID is required'),
@@ -55,20 +56,27 @@ export class ShopController {
       
       if (user && user.role !== 'SUPER_ADMIN') {
         const fullUser = await (this.shopService as any).prisma.user.findUnique({
           where: { id: user.userId },
           select: { organizationId: true }
         })
         organizationId = fullUser?.organizationId
       }
 
       const shops = await this.shopService.getAllShops(organizationId)
+      if (user && (user.role === 'STAFF' || user.role === 'MANAGER')) {
+        const scope = await resolveShopScope((this.shopService as any).prisma, user)
+        if (!scope.allShops) {
+          return res.json({ data: shops.filter(shop => scope.shopIds.includes(shop.id)) })
+        }
+      }
+
       res.json({ data: shops })
     } catch (error: any) {
       res.status(500).json({ error: error.message })
     }
   }
 
   getById = async (req: Request, res: Response) => {
     try {
       const id = String(req.params.id)
       const shop = await this.shopService.getShopById(id)
```
