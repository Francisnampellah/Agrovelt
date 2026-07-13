# Review Package Task 8
BASE: 49c91746e418989125305cd1c7a261ce911238e8
HEAD: 8320e0c4214989a03717b129289635e9199877de

## Commits
8320e0c feat(cashflow): add org funding endpoint with manager ALL_SHOPS gate

## Stat
 src/modules/cashflow/cashflow.service.ts | 13 ++++++++++
 src/modules/cashflow/funding.test.ts     | 44 ++++++++++++++++++++++++++++++++
 src/routes/cashflow.ts                   | 37 +++++++++++++++++++++++++--
 3 files changed, 92 insertions(+), 2 deletions(-)

## Diff
```diff
diff --git a/src/modules/cashflow/cashflow.service.ts b/src/modules/cashflow/cashflow.service.ts
index 1aa3cc5..3519d94 100644
--- a/src/modules/cashflow/cashflow.service.ts
+++ b/src/modules/cashflow/cashflow.service.ts
@@ -12,20 +12,33 @@ export class CashFlowService {
       category: CashFlowCategory
       amount: number
       referenceId?: string
       note?: string
       recordedBy: string
     }
   ) {
     await tx.cashFlowEntry.create({ data })
   }
 
+  async recordFunding(shopId: string, amount: number, recordedBy: string, note = 'Organization funding') {
+    return this.prisma.cashFlowEntry.create({
+      data: {
+        shopId,
+        amount,
+        recordedBy,
+        direction: CashFlowDirection.IN,
+        category: CashFlowCategory.ADJUSTMENT,
+        note
+      }
+    })
+  }
+
   // Public ΓÇö queried by reports and dashboards
   async getSummary(shopId: string, from: Date, to: Date) {
     const entries = await this.prisma.cashFlowEntry.findMany({
       where: { shopId, createdAt: { gte: from, lte: to } }
     })
 
     const totalIn  = entries.filter(e => e.direction === 'IN').reduce((s, e) => s + e.amount, 0)
     const totalOut = entries.filter(e => e.direction === 'OUT').reduce((s, e) => s + e.amount, 0)
     
     return {
diff --git a/src/modules/cashflow/funding.test.ts b/src/modules/cashflow/funding.test.ts
new file mode 100644
index 0000000..8d358e1
--- /dev/null
+++ b/src/modules/cashflow/funding.test.ts
@@ -0,0 +1,44 @@
+import test from 'node:test'
+import assert from 'node:assert/strict'
+import { CashFlowService } from './cashflow.service'
+import { canAddOrgFunding } from '../auth/permissions'
+
+test('recordFunding creates an IN adjustment with the default organization-funding note', async () => {
+  const created: unknown[] = []
+  const prisma = {
+    cashFlowEntry: {
+      create: async ({ data }: { data: unknown }) => {
+        created.push(data)
+      }
+    }
+  }
+
+  const service = new CashFlowService(prisma as never)
+  await service.recordFunding('shop-1', 2500, 'user-1')
+
+  assert.deepEqual(created, [{
+    shopId: 'shop-1',
+    amount: 2500,
+    recordedBy: 'user-1',
+    direction: 'IN',
+    category: 'ADJUSTMENT',
+    note: 'Organization funding'
+  }])
+})
+
+test('organization funding denies ONE_SHOP managers but allows ALL_SHOPS managers and owners', () => {
+  assert.equal(canAddOrgFunding({
+    userId: 'manager-one',
+    role: 'MANAGER',
+    managerAccess: 'ONE_SHOP'
+  }), false)
+  assert.equal(canAddOrgFunding({
+    userId: 'manager-all',
+    role: 'MANAGER',
+    managerAccess: 'ALL_SHOPS'
+  }), true)
+  assert.equal(canAddOrgFunding({
+    userId: 'owner',
+    role: 'OWNER'
+  }), true)
+})
diff --git a/src/routes/cashflow.ts b/src/routes/cashflow.ts
index b310a24..fdb9bb7 100644
--- a/src/routes/cashflow.ts
+++ b/src/routes/cashflow.ts
@@ -1,31 +1,64 @@
 import { Router, Response } from 'express'
 import { PrismaClient, CashFlowCategory } from '@prisma/client'
-import { query, validationResult } from 'express-validator'
+import { body, query, validationResult } from 'express-validator'
 import { AuthMiddleware, AuthService } from '../modules/auth'
 import { loadAuthActor } from '../modules/auth/assertActor'
-import { canViewShopFinance } from '../modules/auth/permissions'
+import { canAddOrgFunding, canViewShopFinance } from '../modules/auth/permissions'
 import { assertShopInScope } from '../modules/auth/shopScope'
 import { AuthenticatedRequest } from '../modules/auth/types'
 import { CashFlowService } from '../modules/cashflow/cashflow.service'
 
 function parseDate(value: unknown, fallback: Date) {
   if (!value) return fallback
   const parsed = new Date(String(value))
   return Number.isNaN(parsed.getTime()) ? fallback : parsed
 }
 
 export function createCashFlowRoutes(prisma: PrismaClient) {
   const router = Router()
   const authMiddleware = new AuthMiddleware(new AuthService(prisma))
   const cashFlowService = new CashFlowService(prisma)
 
+  router.post(
+    '/cashflow/funding',
+    authMiddleware.authenticate,
+    [
+      body('shopId').isUUID().withMessage('Valid shop ID is required'),
+      body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
+      body('note').optional().isString()
+    ],
+    async (req: AuthenticatedRequest, res: Response) => {
+      try {
+        const errors = validationResult(req)
+        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
+
+        const actor = await loadAuthActor(prisma, req)
+        if (!canAddOrgFunding(actor)) {
+          return res.status(403).json({ error: 'Insufficient permissions to record organization funding' })
+        }
+        await assertShopInScope(prisma, actor, String(req.body.shopId))
+
+        const entry = await cashFlowService.recordFunding(
+          String(req.body.shopId),
+          Number(req.body.amount),
+          actor.userId,
+          req.body.note
+        )
+        res.status(201).json({ data: entry })
+      } catch (error: any) {
+        const status = error.message?.includes('Access denied') ? 403 : 400
+        res.status(status).json({ error: error.message })
+      }
+    }
+  )
+
   router.get(
     '/cashflow/summary',
     authMiddleware.authenticate,
     [
       query('shopId').isUUID().withMessage('Valid shop ID is required'),
       query('from').optional().isISO8601().withMessage('Valid from date is required'),
       query('to').optional().isISO8601().withMessage('Valid to date is required')
     ],
     async (req: AuthenticatedRequest, res: Response) => {
       try {
```
