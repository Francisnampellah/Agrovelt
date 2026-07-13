# Review Package Task 7
BASE: fe29c72ed7839a6a98d477711e583f0e2081a538
HEAD: 49c91746e418989125305cd1c7a261ce911238e8

## Commits
49c9174 feat(auth): enforce role and shop scope on operational APIs

## Stat
 src/modules/auth/assertActor.test.ts               | 51 ++++++++++++++++++++
 src/modules/auth/assertActor.ts                    | 24 ++++++++++
 src/modules/expense/expense.controller.ts          | 18 +++++++-
 src/modules/expense/index.ts                       |  2 +-
 src/modules/inventory/index.ts                     |  2 +-
 src/modules/inventory/inventory.controller.ts      | 54 ++++++++++++++--------
 src/modules/purchase/index.ts                      |  2 +-
 src/modules/purchase/purchase.controller.ts        | 18 +++++++-
 src/modules/receipt/receipt.controller.ts          | 48 ++++++++++++++++---
 src/modules/sale/index.ts                          |  2 +-
 .../sale/sale.controller.permissions.test.ts       | 43 +++++++++++++++++
 src/modules/sale/sale.controller.ts                | 27 +++++++++--
 src/routes/cashflow.ts                             | 21 ++++++++-
 13 files changed, 274 insertions(+), 38 deletions(-)

## Diff
```diff
diff --git a/src/modules/auth/assertActor.test.ts b/src/modules/auth/assertActor.test.ts
new file mode 100644
index 0000000..4ecb250
--- /dev/null
+++ b/src/modules/auth/assertActor.test.ts
@@ -0,0 +1,51 @@
+import test from 'node:test'
+import assert from 'node:assert/strict'
+import { loadAuthActor } from './assertActor'
+
+test('loadAuthActor reads the active user authorization state from the database', async () => {
+  const prisma = {
+    user: {
+      findUnique: async () => ({
+        role: 'MANAGER',
+        organizationId: 'org-1',
+        managerAccess: 'ONE_SHOP',
+        isActive: true
+      })
+    }
+  }
+
+  const actor = await loadAuthActor(prisma as never, {
+    user: {
+      userId: 'user-1',
+      email: 'manager@example.com',
+      role: 'STAFF'
+    }
+  } as never)
+
+  assert.deepEqual(actor, {
+    userId: 'user-1',
+    role: 'MANAGER',
+    organizationId: 'org-1',
+    managerAccess: 'ONE_SHOP'
+  })
+})
+
+test('loadAuthActor rejects inactive and missing users', async () => {
+  const prisma = {
+    user: {
+      findUnique: async () => ({
+        role: 'STAFF',
+        organizationId: 'org-1',
+        managerAccess: null,
+        isActive: false
+      })
+    }
+  }
+
+  await assert.rejects(
+    loadAuthActor(prisma as never, {
+      user: { userId: 'user-1', email: 'staff@example.com', role: 'STAFF' }
+    } as never),
+    /User account is deactivated/
+  )
+})
diff --git a/src/modules/auth/assertActor.ts b/src/modules/auth/assertActor.ts
new file mode 100644
index 0000000..0033c02
--- /dev/null
+++ b/src/modules/auth/assertActor.ts
@@ -0,0 +1,24 @@
+import { PrismaClient } from '@prisma/client'
+import { AuthActor } from './permissions'
+import { AuthenticatedRequest } from './types'
+
+export async function loadAuthActor(
+  prisma: PrismaClient,
+  req: AuthenticatedRequest
+): Promise<AuthActor> {
+  if (!req.user) throw new Error('Authentication required')
+
+  const user = await prisma.user.findUnique({
+    where: { id: req.user.userId },
+    select: { role: true, organizationId: true, managerAccess: true, isActive: true }
+  })
+
+  if (!user?.isActive) throw new Error('User account is deactivated')
+
+  return {
+    userId: req.user.userId,
+    role: user.role,
+    organizationId: user.organizationId,
+    ...(user.managerAccess ? { managerAccess: user.managerAccess } : {})
+  }
+}
diff --git a/src/modules/expense/expense.controller.ts b/src/modules/expense/expense.controller.ts
index 85879be..2338ae0 100644
--- a/src/modules/expense/expense.controller.ts
+++ b/src/modules/expense/expense.controller.ts
@@ -1,20 +1,25 @@
 import { Response } from 'express'
+import { PrismaClient } from '@prisma/client'
 import { body, query, validationResult } from 'express-validator'
+import { loadAuthActor } from '../auth/assertActor'
+import { canAddExpense } from '../auth/permissions'
+import { assertShopInScope } from '../auth/shopScope'
 import { AuthenticatedRequest } from '../auth/types'
 import { NotificationService } from '../notifications/notification.service'
 import { ExpenseService } from './expense.service'
 
 export class ExpenseController {
   constructor(
     private expenseService: ExpenseService,
-    private notificationService: NotificationService
+    private notificationService: NotificationService,
+    private prisma: PrismaClient
   ) {}
 
   createValidation = [
     body('shopId').isUUID().withMessage('Valid shop ID is required'),
     body('title').trim().notEmpty().withMessage('Title is required'),
     body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
     body('category').optional().isString(),
     body('date').isISO8601().withMessage('Valid date is required')
   ]
 
@@ -24,46 +29,55 @@ export class ExpenseController {
 
   create = async (req: AuthenticatedRequest, res: Response) => {
     try {
       const errors = validationResult(req)
       if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
 
       if (!req.user) {
         return res.status(401).json({ error: 'Authentication required' })
       }
 
+      const actor = await loadAuthActor(this.prisma, req)
+      await assertShopInScope(this.prisma, actor, String(req.body.shopId))
+      if (!canAddExpense(actor, true)) throw new Error('Insufficient permissions to create expenses')
+
       const expense = await this.expenseService.createExpense({
         ...req.body,
         date: new Date(req.body.date),
         recordedBy: req.user.userId
       })
 
       const shop = await this.expenseService.getExpenseShop(expense.shopId)
       const notification = await this.notificationService.recordFromShopActivity(
         expense.shopId,
         this.notificationService.fromExpense({
           id: expense.id,
           shopId: expense.shopId,
           title: expense.title,
           amount: expense.amount,
           ...(shop ? { shop: { name: shop.name } } : {})
         })
       )
 
       res.status(201).json({ data: expense, notification })
     } catch (error: any) {
-      res.status(400).json({ error: error.message })
+      res.status(this.errorStatus(error)).json({ error: error.message })
     }
   }
 
   list = async (req: AuthenticatedRequest, res: Response) => {
     try {
       const errors = validationResult(req)
       if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
 
       const expenses = await this.expenseService.getExpensesByShop(String(req.query.shopId))
       res.json({ data: expenses })
     } catch (error: any) {
       res.status(400).json({ error: error.message })
     }
   }
+
+  private errorStatus(error: unknown): number {
+    const message = error instanceof Error ? error.message : ''
+    return message.includes('Access denied') || message.includes('Insufficient permissions') ? 403 : 400
+  }
 }
diff --git a/src/modules/expense/index.ts b/src/modules/expense/index.ts
index 6b41a1e..086fcf9 100644
--- a/src/modules/expense/index.ts
+++ b/src/modules/expense/index.ts
@@ -5,16 +5,16 @@ import { NotificationService } from '../notifications/notification.service'
 import { ExpenseService } from './expense.service'
 import { ExpenseController } from './expense.controller'
 
 export function createExpenseModule(prisma: PrismaClient, notificationService?: NotificationService) {
   const cashFlowService = new CashFlowService(prisma)
   const expenseService = new ExpenseService(prisma, cashFlowService)
 
   const notifications =
     notificationService ?? createNotificationModule(prisma).notificationService
 
-  const expenseController = new ExpenseController(expenseService, notifications)
+  const expenseController = new ExpenseController(expenseService, notifications, prisma)
 
   return { expenseService, expenseController }
 }
 
 export { ExpenseService, ExpenseController }
diff --git a/src/modules/inventory/index.ts b/src/modules/inventory/index.ts
index e0b7106..6ebf4cf 100644
--- a/src/modules/inventory/index.ts
+++ b/src/modules/inventory/index.ts
@@ -1,19 +1,19 @@
 import { PrismaClient } from '@prisma/client'
 import { InventoryService } from './inventory.service'
 import { InventoryController } from './inventory.controller'
 import { BulkInventoryService } from './bulk-inventory.service'
 
 export function createInventoryModule(prisma: PrismaClient) {
   const inventoryService = new InventoryService(prisma)
   const bulkInventoryService = new BulkInventoryService(prisma, inventoryService)
-  const inventoryController = new InventoryController(inventoryService, bulkInventoryService)
+  const inventoryController = new InventoryController(inventoryService, bulkInventoryService, prisma)
 
   return {
     inventoryService,
     bulkInventoryService,
     inventoryController
   }
 }
 
 export {
   InventoryService,
diff --git a/src/modules/inventory/inventory.controller.ts b/src/modules/inventory/inventory.controller.ts
index 0230d0c..af933ac 100644
--- a/src/modules/inventory/inventory.controller.ts
+++ b/src/modules/inventory/inventory.controller.ts
@@ -1,59 +1,67 @@
+import { PrismaClient } from '@prisma/client'
 import { Request, Response } from 'express'
 import { body, validationResult } from 'express-validator'
+import { loadAuthActor } from '../auth/assertActor'
+import { canAddStock } from '../auth/permissions'
+import { assertShopInScope } from '../auth/shopScope'
+import { AuthenticatedRequest } from '../auth/types'
 import { InventoryService } from './inventory.service'
 import { BulkInventoryService } from './bulk-inventory.service'
 import { parseExcelFile } from '../../utils/excelParser'
 import { generateInventoryUpdateTemplate, generateInventoryAdjustTemplate, saveTemplate } from '../../utils/excelTemplateGenerator'
 
 export class InventoryController {
   constructor(
     private inventoryService: InventoryService,
-    private bulkInventoryService: BulkInventoryService
+    private bulkInventoryService: BulkInventoryService,
+    private prisma: PrismaClient
   ) {}
 
   updateValidation = [
     body('shopId').isUUID().withMessage('Invalid shop ID'),
     body('variantId').isString().notEmpty().withMessage('Invalid variant ID'),
     body('quantity').isInt({ min: 0 }).withMessage('Quantity must be >= 0'),
     body('costPrice').isFloat({ min: 0 }).withMessage('Cost price must be >= 0')
   ]
 
   adjustValidation = [
     body('shopId').isUUID().withMessage('Invalid shop ID'),
     body('variantId').isString().notEmpty().withMessage('Invalid variant ID'),
     body('change').isInt().withMessage('Change must be an integer'),
     body('type').isIn(['PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN']).withMessage('Invalid transaction type'),
     body('referenceId').optional().isString()
   ]
 
-  update = async (req: Request, res: Response) => {
+  update = async (req: AuthenticatedRequest, res: Response) => {
     try {
       const errors = validationResult(req)
       if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
 
+      await this.assertStockAccess(req, [String(req.body.shopId)])
       const inventory = await this.inventoryService.updateInventory(req.body)
       res.json({ data: inventory })
     } catch (error: any) {
-      res.status(400).json({ error: error.message })
+      res.status(this.errorStatus(error)).json({ error: error.message })
     }
   }
 
-  adjust = async (req: Request, res: Response) => {
+  adjust = async (req: AuthenticatedRequest, res: Response) => {
     try {
       const errors = validationResult(req)
       if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
 
+      await this.assertStockAccess(req, [String(req.body.shopId)])
       const inventory = await this.inventoryService.adjustInventory(req.body)
       res.json({ data: inventory })
     } catch (error: any) {
-      res.status(400).json({ error: error.message })
+      res.status(this.errorStatus(error)).json({ error: error.message })
     }
   }
 
   getByShop = async (req: Request, res: Response) => {
     try {
       const shopId = String(req.params.shopId)
       const inventory = await this.inventoryService.getInventoryByShop(shopId)
       res.json({ data: inventory })
     } catch (error: any) {
       res.status(500).json({ error: error.message })
@@ -63,81 +71,75 @@ export class InventoryController {
   getTransactionsByShop = async (req: Request, res: Response) => {
     try {
       const shopId = String(req.params.shopId)
       const transactions = await this.inventoryService.getTransactionsByShop(shopId)
       res.json({ data: transactions })
     } catch (error: any) {
       res.status(500).json({ error: error.message })
     }
   }
 
-  bulkUpdateInventory = async (req: Request, res: Response) => {
+  bulkUpdateInventory = async (req: AuthenticatedRequest, res: Response) => {
     try {
       if (!(req as any).file) {
         return res.status(400).json({ error: 'No Excel file provided' })
       }
 
       const dryRun = String(req.query.dryRun) === 'true'
       const rows = await parseExcelFile((req as any).file.path)
-      const user = (req as any).user
-
-      if (!user) {
-        return res.status(401).json({ error: 'User authentication required' })
-      }
+      await this.assertStockAccess(req, rows.map((row: { shopId?: string }) => row.shopId).filter(Boolean))
+      const user = req.user!
       
       // Clean up uploaded file
       const fs = await import('fs').then(m => m.promises)
       await fs.unlink((req as any).file.path).catch(() => {})
 
       const result = await this.bulkInventoryService.bulkUpdateInventory(rows, user, dryRun)
       
       const statusCode = result.success ? 200 : 400
       res.status(statusCode).json(result)
     } catch (error: any) {
       // Clean up file on error
       if ((req as any).file) {
         const fs = await import('fs').then(m => m.promises)
         await fs.unlink((req as any).file.path).catch(() => {})
       }
-      res.status(400).json({ error: error.message })
+      res.status(this.errorStatus(error)).json({ error: error.message })
     }
   }
 
-  bulkAdjustInventory = async (req: Request, res: Response) => {
+  bulkAdjustInventory = async (req: AuthenticatedRequest, res: Response) => {
     try {
       if (!(req as any).file) {
         return res.status(400).json({ error: 'No Excel file provided' })
       }
 
       const dryRun = String(req.query.dryRun) === 'true'
       const rows = await parseExcelFile((req as any).file.path)
-      const user = (req as any).user
-
-      if (!user) {
-        return res.status(401).json({ error: 'User authentication required' })
-      }
+      await this.assertStockAccess(req, rows.map((row: { shopId?: string }) => row.shopId).filter(Boolean))
+      const user = req.user!
       
       // Clean up uploaded file
       const fs = await import('fs').then(m => m.promises)
       await fs.unlink((req as any).file.path).catch(() => {})
 
       const result = await this.bulkInventoryService.bulkAdjustInventory(rows, user, dryRun)
       
       const statusCode = result.success ? 200 : 400
       res.status(statusCode).json(result)
     } catch (error: any) {
       // Clean up file on error
       if ((req as any).file) {
         const fs = await import('fs').then(m => m.promises)
         await fs.unlink((req as any).file.path).catch(() => {})
       }
-      res.status(400).json({ error: error.message })
+      res.status(this.errorStatus(error)).json({ error: error.message })
     }
   }
 
   downloadInventoryUpdateTemplate = async (req: Request, res: Response) => {
     try {
       const workbook = await generateInventoryUpdateTemplate()
       const filePath = await saveTemplate(workbook, 'inventory_update_template.xlsx')
       
       res.download(filePath, 'inventory_update_template.xlsx', (err) => {
         if (err) console.error('Download error:', err)
@@ -152,11 +154,25 @@ export class InventoryController {
       const workbook = await generateInventoryAdjustTemplate()
       const filePath = await saveTemplate(workbook, 'inventory_adjust_template.xlsx')
       
       res.download(filePath, 'inventory_adjust_template.xlsx', (err) => {
         if (err) console.error('Download error:', err)
       })
     } catch (error: any) {
       res.status(500).json({ error: error.message })
     }
   }
+
+  private async assertStockAccess(req: AuthenticatedRequest, shopIds: (string | undefined)[]): Promise<void> {
+    const actor = await loadAuthActor(this.prisma, req)
+    if (!canAddStock(actor, true)) throw new Error('Insufficient permissions to modify inventory')
+
+    for (const shopId of new Set(shopIds.filter((value): value is string => Boolean(value)))) {
+      await assertShopInScope(this.prisma, actor, shopId)
+    }
+  }
+
+  private errorStatus(error: unknown): number {
+    const message = error instanceof Error ? error.message : ''
+    return message.includes('Access denied') || message.includes('Insufficient permissions') ? 403 : 400
+  }
 }
diff --git a/src/modules/purchase/index.ts b/src/modules/purchase/index.ts
index 72d7afc..0771765 100644
--- a/src/modules/purchase/index.ts
+++ b/src/modules/purchase/index.ts
@@ -9,16 +9,16 @@ import { PurchaseController } from './purchase.controller'
 
 export function createPurchaseModule(prisma: PrismaClient, notificationService?: NotificationService) {
   const inventoryService = new InventoryService(prisma)
   const pricingService = new PricingService(prisma)
   const cashFlowService = new CashFlowService(prisma)
   const purchaseService = new PurchaseService(prisma, inventoryService, pricingService, cashFlowService)
 
   const notifications =
     notificationService ?? createNotificationModule(prisma).notificationService
 
-  const purchaseController = new PurchaseController(purchaseService, notifications)
+  const purchaseController = new PurchaseController(purchaseService, notifications, prisma)
 
   return { purchaseService, purchaseController }
 }
 
 export { PurchaseService, PurchaseController }
diff --git a/src/modules/purchase/purchase.controller.ts b/src/modules/purchase/purchase.controller.ts
index 012efd9..5a75011 100644
--- a/src/modules/purchase/purchase.controller.ts
+++ b/src/modules/purchase/purchase.controller.ts
@@ -1,20 +1,25 @@
 import { Response } from 'express'
+import { PrismaClient } from '@prisma/client'
 import { body, query, validationResult } from 'express-validator'
+import { loadAuthActor } from '../auth/assertActor'
+import { canPurchase } from '../auth/permissions'
+import { assertShopInScope } from '../auth/shopScope'
 import { AuthenticatedRequest } from '../auth/types'
 import { NotificationService } from '../notifications/notification.service'
 import { PurchaseService } from './purchase.service'
 
 export class PurchaseController {
   constructor(
     private purchaseService: PurchaseService,
-    private notificationService: NotificationService
+    private notificationService: NotificationService,
+    private prisma: PrismaClient
   ) {}
 
   createValidation = [
     body('shopId').isUUID().withMessage('Valid shop ID is required'),
     body('supplierId').optional().isUUID(),
     body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
     body('items.*.variantId').isString().notEmpty().withMessage('Valid variant ID is required'),
     body('items.*.quantity').isInt({ min: 1 }),
     body('items.*.costPrice').isFloat({ min: 0 }),
     body('items.*.batchNumber').optional().isString(),
@@ -27,20 +32,24 @@ export class PurchaseController {
 
   create = async (req: AuthenticatedRequest, res: Response) => {
     try {
       const errors = validationResult(req)
       if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
 
       if (!req.user) {
         return res.status(401).json({ error: 'Authentication required' })
       }
 
+      const actor = await loadAuthActor(this.prisma, req)
+      await assertShopInScope(this.prisma, actor, String(req.body.shopId))
+      if (!canPurchase(actor, true)) throw new Error('Insufficient permissions to create purchases')
+
       const items = req.body.items.map((item: any) => ({
         ...item,
         ...(item.expiryDate ? { expiryDate: new Date(item.expiryDate) } : {})
       }))
 
       const purchase = await this.purchaseService.createPurchase({
         shopId: req.body.shopId,
         supplierId: req.body.supplierId,
         items,
         createdBy: req.user.userId
@@ -50,26 +59,31 @@ export class PurchaseController {
         return res.status(400).json({ error: 'Failed to create purchase' })
       }
 
       const notification = await this.notificationService.recordFromShopActivity(
         purchase.shopId,
         this.notificationService.fromPurchase(purchase)
       )
 
       res.status(201).json({ data: purchase, notification })
     } catch (error: any) {
-      res.status(400).json({ error: error.message })
+      res.status(this.errorStatus(error)).json({ error: error.message })
     }
   }
 
   list = async (req: AuthenticatedRequest, res: Response) => {
     try {
       const errors = validationResult(req)
       if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
 
       const purchases = await this.purchaseService.getPurchasesByShop(String(req.query.shopId))
       res.json({ data: purchases })
     } catch (error: any) {
       res.status(400).json({ error: error.message })
     }
   }
+
+  private errorStatus(error: unknown): number {
+    const message = error instanceof Error ? error.message : ''
+    return message.includes('Access denied') || message.includes('Insufficient permissions') ? 403 : 400
+  }
 }
diff --git a/src/modules/receipt/receipt.controller.ts b/src/modules/receipt/receipt.controller.ts
index 2edc589..7bf3b33 100644
--- a/src/modules/receipt/receipt.controller.ts
+++ b/src/modules/receipt/receipt.controller.ts
@@ -1,15 +1,18 @@
 import { Response } from 'express'
 import { query, validationResult } from 'express-validator'
 import { ReceiptStatus } from '@prisma/client'
 import { PrismaClient } from '@prisma/client'
 import { AuthenticatedRequest } from '../auth/types'
+import { loadAuthActor } from '../auth/assertActor'
+import { canDownloadReceipt } from '../auth/permissions'
+import { assertShopInScope, resolveShopScope } from '../auth/shopScope'
 import { assertOrganizationAccess } from '../organizations/organization-access'
 import { ReceiptService } from './receipt.service'
 
 export class ReceiptController {
   constructor(
     private receiptService: ReceiptService,
     private prisma: PrismaClient
   ) {}
 
   listValidation = [
@@ -37,85 +40,118 @@ export class ReceiptController {
 
   listByShop = async (req: AuthenticatedRequest, res: Response) => {
     try {
       const errors = validationResult(req)
       if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
 
       if (!req.query.shopId) {
         return res.status(400).json({ error: 'shopId query parameter is required' })
       }
 
+      await this.assertReceiptShopAccess(req, String(req.query.shopId))
       const receipts = await this.receiptService.getReceiptsByShop(
         String(req.query.shopId),
         this.parseFilters(req)
       )
 
       res.json({ data: receipts })
     } catch (error: any) {
-      res.status(400).json({ error: error.message })
+      res.status(this.errorStatus(error)).json({ error: error.message })
     }
   }
 
   listByOrganization = async (req: AuthenticatedRequest, res: Response) => {
     try {
       const errors = validationResult(req)
       if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
 
       if (!req.user) {
         return res.status(401).json({ error: 'Authentication required' })
       }
 
       const organizationId = String(req.params.organizationId)
       await assertOrganizationAccess(this.prisma, req.user.userId, req.user.role, organizationId)
+      const actor = await loadAuthActor(this.prisma, req)
+      if (!canDownloadReceipt(actor, true)) {
+        throw new Error('Insufficient permissions to access receipts')
+      }
+
+      if (req.query.shopId) {
+        await assertShopInScope(this.prisma, actor, String(req.query.shopId))
+      } else if (actor.role !== 'ADMIN' && actor.role !== 'SUPER_ADMIN') {
+        const scope = await resolveShopScope(this.prisma, actor)
+        if (!scope.allShops) {
+          throw new Error('Access denied to receipts outside the assigned shop scope')
+        }
+      }
 
       const receipts = await this.receiptService.getReceiptsByOrganization(
         organizationId,
         this.parseFilters(req)
       )
 
       res.json({ data: receipts })
     } catch (error: any) {
       const status = error.message === 'Organization not found'
         ? 404
         : error.message === 'Access denied to this organization'
           ? 403
-          : 400
+          : this.errorStatus(error)
       res.status(status).json({ error: error.message })
     }
   }
 
   getById = async (req: AuthenticatedRequest, res: Response) => {
     try {
       const receipt = await this.receiptService.getReceiptById(String(req.params.receiptId))
+      await this.assertReceiptShopAccess(req, receipt.shopId)
       res.json({ data: receipt })
     } catch (error: any) {
-      res.status(error.message === 'Receipt not found' ? 404 : 400).json({ error: error.message })
+      res.status(error.message === 'Receipt not found' ? 404 : this.errorStatus(error)).json({ error: error.message })
     }
   }
 
   getByNumber = async (req: AuthenticatedRequest, res: Response) => {
     try {
       const receipt = await this.receiptService.getReceiptByNumber(String(req.params.receiptNumber))
+      await this.assertReceiptShopAccess(req, receipt.shopId)
       res.json({ data: receipt })
     } catch (error: any) {
-      res.status(error.message === 'Receipt not found' ? 404 : 400).json({ error: error.message })
+      res.status(error.message === 'Receipt not found' ? 404 : this.errorStatus(error)).json({ error: error.message })
     }
   }
 
   markPrinted = async (req: AuthenticatedRequest, res: Response) => {
     try {
+      const existingReceipt = await this.receiptService.getReceiptById(String(req.params.receiptId))
+      await this.assertReceiptShopAccess(req, existingReceipt.shopId)
       const receipt = await this.receiptService.markPrinted(String(req.params.receiptId))
       res.json({ message: 'Receipt marked as printed', data: receipt })
     } catch (error: any) {
-      res.status(error.message === 'Receipt not found' ? 404 : 400).json({ error: error.message })
+      res.status(error.message === 'Receipt not found' ? 404 : this.errorStatus(error)).json({ error: error.message })
     }
   }
 
   voidReceipt = async (req: AuthenticatedRequest, res: Response) => {
     try {
+      const existingReceipt = await this.receiptService.getReceiptById(String(req.params.receiptId))
+      await this.assertReceiptShopAccess(req, existingReceipt.shopId)
       const receipt = await this.receiptService.voidReceipt(String(req.params.receiptId))
       res.json({ message: 'Receipt voided', data: receipt })
     } catch (error: any) {
-      res.status(error.message === 'Receipt not found' ? 404 : 400).json({ error: error.message })
+      res.status(error.message === 'Receipt not found' ? 404 : this.errorStatus(error)).json({ error: error.message })
+    }
+  }
+
+  private async assertReceiptShopAccess(req: AuthenticatedRequest, shopId: string): Promise<void> {
+    const actor = await loadAuthActor(this.prisma, req)
+    await assertShopInScope(this.prisma, actor, shopId)
+    if (!canDownloadReceipt(actor, true)) {
+      throw new Error('Insufficient permissions to access receipts')
     }
   }
+
+  private errorStatus(error: unknown): number {
+    const message = error instanceof Error ? error.message : ''
+    return message.includes('Access denied') || message.includes('Insufficient permissions') ? 403 : 400
+  }
 }
diff --git a/src/modules/sale/index.ts b/src/modules/sale/index.ts
index 8f8182a..dcadcf7 100644
--- a/src/modules/sale/index.ts
+++ b/src/modules/sale/index.ts
@@ -20,21 +20,21 @@ export function createSaleModule(
     prisma,
     inventoryService,
     cashFlowService,
     pricingService,
     receiptService
   )
 
   const notifications =
     notificationService ?? createNotificationModule(prisma).notificationService
 
-  const saleController = new SaleController(saleService, notifications)
+  const saleController = new SaleController(saleService, notifications, prisma)
 
   return {
     saleService,
     saleController
   }
 }
 
 export { SaleService, SaleController }
 export * from './types'
 export * from './sale.swagger'
diff --git a/src/modules/sale/sale.controller.permissions.test.ts b/src/modules/sale/sale.controller.permissions.test.ts
new file mode 100644
index 0000000..a07002b
--- /dev/null
+++ b/src/modules/sale/sale.controller.permissions.test.ts
@@ -0,0 +1,43 @@
+import test from 'node:test'
+import assert from 'node:assert/strict'
+import { SaleController } from './sale.controller'
+
+test('sale creation returns 403 when the shop is outside the actor scope', async () => {
+  const dbUser = {
+    role: 'STAFF',
+    organizationId: 'org-1',
+    managerAccess: null,
+    isActive: true,
+    staffIn: [{ shop: { id: 'shop-1', name: 'Assigned' } }],
+    shopsOwned: []
+  }
+  const prisma = {
+    user: { findUnique: async () => dbUser },
+    shop: { findMany: async () => [] }
+  }
+  const controller = new SaleController(
+    { createSale: async () => assert.fail('sale must not be created') } as never,
+    {} as never,
+    prisma as never
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
+  await controller.create({
+    body: { shopId: 'shop-2', paymentMethod: 'CASH', items: [{ variantId: 'variant-1', quantity: 1 }] },
+    user: { userId: 'user-1', email: 'staff@example.com', role: 'STAFF' }
+  } as never, res as never)
+
+  assert.equal(statusCode, 403)
+  assert.deepEqual(responseBody, { error: 'Access denied to this shop' })
+})
diff --git a/src/modules/sale/sale.controller.ts b/src/modules/sale/sale.controller.ts
index 971ae28..b30bee0 100644
--- a/src/modules/sale/sale.controller.ts
+++ b/src/modules/sale/sale.controller.ts
@@ -1,21 +1,26 @@
 import { Response } from 'express'
+import { PrismaClient } from '@prisma/client'
 import { body, query, validationResult } from 'express-validator'
+import { loadAuthActor } from '../auth/assertActor'
+import { canRefund, canSell } from '../auth/permissions'
+import { assertShopInScope } from '../auth/shopScope'
 import { AuthenticatedRequest } from '../auth/types'
 import { NotificationService } from '../notifications/notification.service'
 import { SaleCreationConflictError, SaleService } from './sale.service'
 import { CreateSaleRequest } from './types'
 
 export class SaleController {
   constructor(
     private saleService: SaleService,
-    private notificationService: NotificationService
+    private notificationService: NotificationService,
+    private prisma: PrismaClient
   ) {}
 
   createValidation = [
     body('shopId').isUUID().withMessage('Valid shop ID is required'),
     body('paymentMethod').isIn(['CASH', 'CARD', 'MOBILE']).withMessage('Invalid payment method'),
     body('items').isArray({ min: 1 }).withMessage('At least one sale item is required'),
     body('items.*.inventoryId').optional().isUUID().withMessage('inventoryId must be a valid UUID'),
     body('items.*.variantId').isString().notEmpty().withMessage('Valid variant ID is required'),
     body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
     body('items.*.price').optional().isFloat({ min: 0 }),
@@ -36,20 +41,24 @@ export class SaleController {
 
   create = async (req: AuthenticatedRequest, res: Response) => {
     try {
       const errors = validationResult(req)
       if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
 
       if (!req.user) {
         return res.status(401).json({ error: 'Authentication required' })
       }
 
+      const actor = await loadAuthActor(this.prisma, req)
+      await assertShopInScope(this.prisma, actor, String(req.body.shopId))
+      if (!canSell(actor, true)) throw new Error('Insufficient permissions to create sales')
+
       const payload: CreateSaleRequest = {
         ...req.body,
         createdBy: req.user.userId
       }
 
       const sale = await this.saleService.createSale(payload)
       if (!sale) {
         return res.status(400).json({ error: 'Failed to create sale' })
       }
 
@@ -61,21 +70,23 @@ export class SaleController {
           shopId: sale.shopId,
           total: sale.total,
           status: sale.status,
           createdAt: sale.createdAt,
           ...(shop ? { shop: { name: shop.name } } : {})
         })
       )
 
       res.status(201).json({ data: sale, receipt: sale.receipt, notification })
     } catch (error: any) {
-      const statusCode = error instanceof SaleCreationConflictError ? error.statusCode : 400
+      const statusCode = error instanceof SaleCreationConflictError
+        ? error.statusCode
+        : this.errorStatus(error)
       res.status(statusCode).json({ error: error.message })
     }
   }
 
   list = async (req: AuthenticatedRequest, res: Response) => {
     try {
       const errors = validationResult(req)
       if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
 
       const shopId = String(req.query.shopId)
@@ -94,20 +105,25 @@ export class SaleController {
       res.status(error.message === 'Sale not found' ? 404 : 400).json({ error: error.message })
     }
   }
 
   refund = async (req: AuthenticatedRequest, res: Response) => {
     try {
       if (!req.user) {
         return res.status(401).json({ error: 'Authentication required' })
       }
 
+      const actor = await loadAuthActor(this.prisma, req)
+      const existingSale = await this.saleService.getSaleById(String(req.params.saleId))
+      await assertShopInScope(this.prisma, actor, existingSale.shopId)
+      if (!canRefund(actor, true)) throw new Error('Insufficient permissions to refund sales')
+
       const refundedBy = req.body.refundedBy || req.user.userId
       const sale = await this.saleService.refundSale(String(req.params.saleId), refundedBy)
       if (!sale) {
         return res.status(400).json({ error: 'Failed to refund sale' })
       }
 
       const shop = await this.saleService.getSaleShop(sale.shopId)
       const notification = await this.notificationService.recordFromShopActivity(
         sale.shopId,
         this.notificationService.fromSale({
@@ -115,14 +131,19 @@ export class SaleController {
           shopId: sale.shopId,
           total: sale.total,
           status: sale.status,
           createdAt: sale.createdAt,
           ...(shop ? { shop: { name: shop.name } } : {})
         })
       )
 
       res.json({ message: 'Sale refunded successfully', data: sale, receipt: sale.receipt, notification })
     } catch (error: any) {
-      res.status(400).json({ error: error.message })
+      res.status(this.errorStatus(error)).json({ error: error.message })
     }
   }
+
+  private errorStatus(error: unknown): number {
+    const message = error instanceof Error ? error.message : ''
+    return message.includes('Access denied') || message.includes('Insufficient permissions') ? 403 : 400
+  }
 }
diff --git a/src/routes/cashflow.ts b/src/routes/cashflow.ts
index be2aa0a..b310a24 100644
--- a/src/routes/cashflow.ts
+++ b/src/routes/cashflow.ts
@@ -1,14 +1,17 @@
 import { Router, Response } from 'express'
 import { PrismaClient, CashFlowCategory } from '@prisma/client'
 import { query, validationResult } from 'express-validator'
 import { AuthMiddleware, AuthService } from '../modules/auth'
+import { loadAuthActor } from '../modules/auth/assertActor'
+import { canViewShopFinance } from '../modules/auth/permissions'
+import { assertShopInScope } from '../modules/auth/shopScope'
 import { AuthenticatedRequest } from '../modules/auth/types'
 import { CashFlowService } from '../modules/cashflow/cashflow.service'
 
 function parseDate(value: unknown, fallback: Date) {
   if (!value) return fallback
   const parsed = new Date(String(value))
   return Number.isNaN(parsed.getTime()) ? fallback : parsed
 }
 
 export function createCashFlowRoutes(prisma: PrismaClient) {
@@ -22,56 +25,70 @@ export function createCashFlowRoutes(prisma: PrismaClient) {
     [
       query('shopId').isUUID().withMessage('Valid shop ID is required'),
       query('from').optional().isISO8601().withMessage('Valid from date is required'),
       query('to').optional().isISO8601().withMessage('Valid to date is required')
     ],
     async (req: AuthenticatedRequest, res: Response) => {
       try {
         const errors = validationResult(req)
         if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
 
+        const actor = await loadAuthActor(prisma, req)
+        await assertShopInScope(prisma, actor, String(req.query.shopId))
+        if (!canViewShopFinance(actor, true)) {
+          return res.status(403).json({ error: 'Insufficient permissions to view shop finance' })
+        }
+
         const from = parseDate(req.query.from, new Date(0))
         const to = parseDate(req.query.to, new Date())
         const summary = await cashFlowService.getSummary(String(req.query.shopId), from, to)
 
         res.json({ data: summary })
       } catch (error: any) {
-        res.status(400).json({ error: error.message })
+        const status = error.message?.includes('Access denied') ? 403 : 400
+        res.status(status).json({ error: error.message })
       }
     }
   )
 
   router.get(
     '/cashflow/entries',
     authMiddleware.authenticate,
     [
       query('shopId').isUUID().withMessage('Valid shop ID is required'),
       query('direction').optional().isIn(['IN', 'OUT']).withMessage('Direction must be IN or OUT'),
       query('category').optional().isString(),
       query('from').optional().isISO8601().withMessage('Valid from date is required'),
       query('to').optional().isISO8601().withMessage('Valid to date is required'),
       query('take').optional().isInt({ min: 1, max: 100 }).withMessage('Take must be between 1 and 100')
     ],
     async (req: AuthenticatedRequest, res: Response) => {
       try {
         const errors = validationResult(req)
         if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
 
+        const actor = await loadAuthActor(prisma, req)
+        await assertShopInScope(prisma, actor, String(req.query.shopId))
+        if (!canViewShopFinance(actor, true)) {
+          return res.status(403).json({ error: 'Insufficient permissions to view shop finance' })
+        }
+
         const filters: Parameters<CashFlowService['getEntries']>[1] = {}
         if (req.query.direction) filters.direction = req.query.direction as 'IN' | 'OUT'
         if (req.query.category) filters.category = req.query.category as CashFlowCategory
         if (req.query.from) filters.from = new Date(String(req.query.from))
         if (req.query.to) filters.to = new Date(String(req.query.to))
         if (req.query.cursor) filters.cursor = String(req.query.cursor)
         if (req.query.take) filters.take = Number(req.query.take)
 
         const entries = await cashFlowService.getEntries(String(req.query.shopId), filters)
 
         res.json({ data: entries })
       } catch (error: any) {
-        res.status(400).json({ error: error.message })
+        const status = error.message?.includes('Access denied') ? 403 : 400
+        res.status(status).json({ error: error.message })
       }
     }
   )
 
   return router
 }
```
