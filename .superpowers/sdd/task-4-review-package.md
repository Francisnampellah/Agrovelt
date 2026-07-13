# Review Package Task 4
BASE: 105826ef2451f4f892c7e5b7eeb2b105e8a938e0
HEAD: 46cfa4b379b6059b28790f143b4c49fbeafef8b5

## Commits
46cfa4b feat(org): expose OWNER user management HTTP APIs

## Stat
 src/modules/organizations/index.ts                |  15 ++-
 src/modules/organizations/org-users.controller.ts | 133 ++++++++++++++++++++++
 src/modules/organizations/organization.swagger.ts | 107 +++++++++++++++++
 src/routes/organizations.ts                       |  28 ++++-
 4 files changed, 280 insertions(+), 3 deletions(-)

## Diff
```diff
diff --git a/src/modules/organizations/index.ts b/src/modules/organizations/index.ts
index 9c25e06..a0a2415 100644
--- a/src/modules/organizations/index.ts
+++ b/src/modules/organizations/index.ts
@@ -4,54 +4,65 @@ import { createNotificationModule } from '../notifications'
 import { createInventoryModule } from '../inventory'
 import { createShopModule } from '../shops'
 import { NotificationService } from '../notifications/notification.service'
 import { ExpenseService } from '../expense/expense.service'
 import { InventoryService } from '../inventory/inventory.service'
 import { PurchaseService } from '../purchase/purchase.service'
 import { SaleService } from '../sale/sale.service'
 import { ShopService } from '../shops/shop.service'
 import { OrganizationService } from './organization.service'
 import { OrganizationController } from './organization.controller'
+import { OrgUsersService } from './org-users.service'
+import { OrgUsersController } from './org-users.controller'
 
 export interface OrganizationModuleDeps {
   saleService: SaleService
   expenseService: ExpenseService
   purchaseService: PurchaseService
   notificationService: NotificationService
   inventoryService: InventoryService
   shopService: ShopService
 }
 
 export function createOrganizationModule(
   prisma: PrismaClient,
   deps?: OrganizationModuleDeps
 ) {
   const authService = new AuthService(prisma)
   const organizationService = new OrganizationService(prisma)
+  const orgUsersService = new OrgUsersService(prisma)
 
   const services = deps ?? {
     ...createNotificationModule(prisma),
     ...createInventoryModule(prisma),
     ...createShopModule(prisma)
   }
 
   const organizationController = new OrganizationController(
     organizationService,
     authService,
     prisma,
     services.saleService,
     services.expenseService,
     services.purchaseService,
     services.notificationService,
     services.inventoryService,
     services.shopService
   )
+  const orgUsersController = new OrgUsersController(orgUsersService, prisma)
 
   return {
     organizationService,
-    organizationController
+    organizationController,
+    orgUsersService,
+    orgUsersController
   }
 }
 
-export { OrganizationService, OrganizationController }
+export {
+  OrganizationService,
+  OrganizationController,
+  OrgUsersService,
+  OrgUsersController
+}
 export * from './types'
 export * from './organization.swagger'
diff --git a/src/modules/organizations/org-users.controller.ts b/src/modules/organizations/org-users.controller.ts
new file mode 100644
index 0000000..74a4f8c
--- /dev/null
+++ b/src/modules/organizations/org-users.controller.ts
@@ -0,0 +1,133 @@
+import { PrismaClient } from '@prisma/client'
+import { Response } from 'express'
+import { body, validationResult } from 'express-validator'
+import { AuthActor } from '../auth/permissions'
+import { AuthenticatedRequest } from '../auth/types'
+import { OrgUsersService } from './org-users.service'
+import { CreateOrgUserInput, UpdateOrgUserInput } from './types'
+
+export class OrgUsersController {
+  constructor(
+    private orgUsersService: OrgUsersService,
+    private prisma: PrismaClient
+  ) {}
+
+  createValidation = [
+    body('name').trim().notEmpty().withMessage('Name is required'),
+    body('email').trim().notEmpty().isEmail().withMessage('Valid email is required'),
+    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
+    body('role').isIn(['STAFF', 'MANAGER']).withMessage('Role must be STAFF or MANAGER'),
+    body('managerAccess').optional().isIn(['ONE_SHOP', 'ALL_SHOPS'])
+      .withMessage('managerAccess must be ONE_SHOP or ALL_SHOPS'),
+    body('shopId').optional().isUUID().withMessage('shopId must be a valid UUID')
+  ]
+
+  updateValidation = [
+    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
+    body('email').optional().trim().isEmail().withMessage('Email must be valid'),
+    body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
+    body('role').optional().isIn(['STAFF', 'MANAGER']).withMessage('Role must be STAFF or MANAGER'),
+    body('managerAccess').optional().isIn(['ONE_SHOP', 'ALL_SHOPS'])
+      .withMessage('managerAccess must be ONE_SHOP or ALL_SHOPS'),
+    body('shopId').optional().isUUID().withMessage('shopId must be a valid UUID')
+  ]
+
+  create = async (req: AuthenticatedRequest, res: Response) => {
+    try {
+      const errors = validationResult(req)
+      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
+
+      const actor = await this.loadAuthActor(req)
+      const user = await this.orgUsersService.createOrgUser(
+        actor,
+        String(req.params.id),
+        req.body as CreateOrgUserInput
+      )
+
+      res.status(201).json({ data: user })
+    } catch (error: any) {
+      this.sendError(res, error)
+    }
+  }
+
+  list = async (req: AuthenticatedRequest, res: Response) => {
+    try {
+      const actor = await this.loadAuthActor(req)
+      const users = await this.orgUsersService.listOrgUsers(actor, String(req.params.id))
+
+      res.json({ data: users })
+    } catch (error: any) {
+      this.sendError(res, error)
+    }
+  }
+
+  update = async (req: AuthenticatedRequest, res: Response) => {
+    try {
+      const errors = validationResult(req)
+      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
+
+      const actor = await this.loadAuthActor(req)
+      const user = await this.orgUsersService.updateOrgUser(
+        actor,
+        String(req.params.id),
+        String(req.params.userId),
+        req.body as UpdateOrgUserInput
+      )
+
+      res.json({ data: user })
+    } catch (error: any) {
+      this.sendError(res, error)
+    }
+  }
+
+  deactivate = async (req: AuthenticatedRequest, res: Response) => {
+    try {
+      const actor = await this.loadAuthActor(req)
+      const user = await this.orgUsersService.deactivateOrgUser(
+        actor,
+        String(req.params.id),
+        String(req.params.userId)
+      )
+
+      res.json({ data: user })
+    } catch (error: any) {
+      this.sendError(res, error)
+    }
+  }
+
+  private async loadAuthActor(req: AuthenticatedRequest): Promise<AuthActor> {
+    if (!req.user) {
+      throw Object.assign(new Error('Authentication required'), { status: 401 })
+    }
+
+    const dbUser = await this.prisma.user.findUnique({
+      where: { id: req.user.userId },
+      select: { managerAccess: true, organizationId: true }
+    })
+    const organizationId = req.user.organizationId ?? dbUser?.organizationId
+
+    return {
+      userId: req.user.userId,
+      role: req.user.role,
+      ...(organizationId !== undefined ? { organizationId } : {}),
+      ...(dbUser?.managerAccess ? { managerAccess: dbUser.managerAccess } : {})
+    }
+  }
+
+  private sendError(res: Response, error: any): void {
+    const message = error instanceof Error ? error.message : 'Unexpected error'
+    const status = error?.status ?? this.errorStatus(message)
+    res.status(status).json({ error: message })
+  }
+
+  private errorStatus(message: string): number {
+    if (
+      message.includes('Insufficient permissions') ||
+      message.includes('Access denied')
+    ) {
+      return 403
+    }
+    if (message.includes('not found')) return 404
+    return 400
+  }
+}
diff --git a/src/modules/organizations/organization.swagger.ts b/src/modules/organizations/organization.swagger.ts
index 5446bd8..1d47aec 100644
--- a/src/modules/organizations/organization.swagger.ts
+++ b/src/modules/organizations/organization.swagger.ts
@@ -280,11 +280,118 @@
  *         schema: { type: string, format: uuid }
  *       - name: limit
  *         in: query
  *         schema: { type: integer, minimum: 1, maximum: 200, default: 50 }
  *       - name: cursor
  *         in: query
  *         schema: { type: string, format: uuid }
  *     responses:
  *       200:
  *         description: Inventory transactions
+ *
+ * /api/organizations/{id}/users:
+ *   post:
+ *     tags: [Organizations, Users]
+ *     summary: Create an organization user
+ *     security: [{ bearerAuth: [] }]
+ *     parameters:
+ *       - name: id
+ *         in: path
+ *         required: true
+ *         schema: { type: string, format: uuid }
+ *     requestBody:
+ *       required: true
+ *       content:
+ *         application/json:
+ *           schema:
+ *             type: object
+ *             required: [name, email, password, role]
+ *             properties:
+ *               name: { type: string }
+ *               email: { type: string, format: email }
+ *               password: { type: string, minLength: 8 }
+ *               role: { type: string, enum: [STAFF, MANAGER] }
+ *               managerAccess: { type: string, enum: [ONE_SHOP, ALL_SHOPS] }
+ *               shopId: { type: string, format: uuid }
+ *     responses:
+ *       201:
+ *         description: Organization user created
+ *       400:
+ *         description: Invalid input or assignment
+ *       403:
+ *         description: Insufficient permissions
+ *       404:
+ *         description: Shop not found in organization
+ *   get:
+ *     tags: [Organizations, Users]
+ *     summary: List organization users
+ *     security: [{ bearerAuth: [] }]
+ *     parameters:
+ *       - name: id
+ *         in: path
+ *         required: true
+ *         schema: { type: string, format: uuid }
+ *     responses:
+ *       200:
+ *         description: Organization users
+ *       403:
+ *         description: Insufficient permissions
+ *
+ * /api/organizations/{id}/users/{userId}:
+ *   patch:
+ *     tags: [Organizations, Users]
+ *     summary: Update an organization user
+ *     security: [{ bearerAuth: [] }]
+ *     parameters:
+ *       - name: id
+ *         in: path
+ *         required: true
+ *         schema: { type: string, format: uuid }
+ *       - name: userId
+ *         in: path
+ *         required: true
+ *         schema: { type: string, format: uuid }
+ *     requestBody:
+ *       required: true
+ *       content:
+ *         application/json:
+ *           schema:
+ *             type: object
+ *             properties:
+ *               name: { type: string }
+ *               email: { type: string, format: email }
+ *               password: { type: string, minLength: 8 }
+ *               role: { type: string, enum: [STAFF, MANAGER] }
+ *               managerAccess: { type: string, enum: [ONE_SHOP, ALL_SHOPS] }
+ *               shopId: { type: string, format: uuid }
+ *     responses:
+ *       200:
+ *         description: Organization user updated
+ *       400:
+ *         description: Invalid input or assignment
+ *       403:
+ *         description: Insufficient permissions
+ *       404:
+ *         description: User or shop not found
+ *
+ * /api/organizations/{id}/users/{userId}/deactivate:
+ *   post:
+ *     tags: [Organizations, Users]
+ *     summary: Deactivate an organization user
+ *     security: [{ bearerAuth: [] }]
+ *     parameters:
+ *       - name: id
+ *         in: path
+ *         required: true
+ *         schema: { type: string, format: uuid }
+ *       - name: userId
+ *         in: path
+ *         required: true
+ *         schema: { type: string, format: uuid }
+ *     responses:
+ *       200:
+ *         description: Organization user deactivated
+ *       403:
+ *         description: Insufficient permissions
+ *       404:
+ *         description: User not found
  */
diff --git a/src/routes/organizations.ts b/src/routes/organizations.ts
index 7c56bfe..96f2a37 100644
--- a/src/routes/organizations.ts
+++ b/src/routes/organizations.ts
@@ -3,21 +3,21 @@ import { PrismaClient } from '@prisma/client'
 import { AuthMiddleware, AuthService } from '../modules/auth'
 import { createOrganizationModule, OrganizationModuleDeps } from '../modules/organizations'
 
 const router = Router()
 
 export function createOrganizationRoutes(
   prisma: PrismaClient,
   deps?: OrganizationModuleDeps
 ) {
   const authMiddleware = new AuthMiddleware(new AuthService(prisma))
-  const { organizationController } = createOrganizationModule(prisma, deps)
+  const { organizationController, orgUsersController } = createOrganizationModule(prisma, deps)
 
 /**
  * @swagger
  * /api/organizations:
  *   post:
  *     summary: Create a new organization
  *     tags: [Organizations]
  *     security:
  *       - bearerAuth: []
  *     description: |
@@ -126,20 +126,46 @@ export function createOrganizationRoutes(
     organizationController.stockTransactionsValidation,
     organizationController.getStockTransactions
   )
 
   router.get(
     '/organizations/:id/stock',
     authMiddleware.authenticate,
     organizationController.getStock
   )
 
+  router.post(
+    '/organizations/:id/users',
+    authMiddleware.authenticate,
+    orgUsersController.createValidation,
+    orgUsersController.create
+  )
+
+  router.get(
+    '/organizations/:id/users',
+    authMiddleware.authenticate,
+    orgUsersController.list
+  )
+
+  router.patch(
+    '/organizations/:id/users/:userId',
+    authMiddleware.authenticate,
+    orgUsersController.updateValidation,
+    orgUsersController.update
+  )
+
+  router.post(
+    '/organizations/:id/users/:userId/deactivate',
+    authMiddleware.authenticate,
+    orgUsersController.deactivate
+  )
+
 /**
  * @swagger
  * /api/organizations:
  *   get:
  *     summary: Get all organizations
  *     tags: [Organizations]
  *     security:
  *       - bearerAuth: []
  *     description: |
  *       **SUPER_ADMIN only** - List all organizations in the system.
```
