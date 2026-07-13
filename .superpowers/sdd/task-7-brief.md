### Task 7: Enforce permissions on sales, expenses, inventory, purchases, receipts, cashflow

**Files:**
- Modify: `src/modules/sale/sale.controller.ts`
- Modify: `src/modules/expense/expense.controller.ts`
- Modify: `src/modules/inventory/inventory.controller.ts`
- Modify: `src/modules/purchase/purchase.controller.ts`
- Modify: `src/modules/receipt/receipt.controller.ts`
- Modify: `src/routes/cashflow.ts`
- Modify: `src/routes/sales.ts`, `expenses.ts`, `inventory.ts`, `purchases.ts`, `receipts.ts` (optional middleware mount)
- Create: `src/modules/auth/assertActor.ts` helper to load AuthActor from req

**Interfaces:**
- Produces: `async function loadAuthActor(prisma, req): Promise<AuthActor>`

- [ ] **Step 1: Add loadAuthActor helper**

```typescript
export async function loadAuthActor(prisma: PrismaClient, req: AuthenticatedRequest): Promise<AuthActor> {
  if (!req.user) throw new Error('Authentication required')
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { role: true, organizationId: true, managerAccess: true, isActive: true }
  })
  if (!user?.isActive) throw new Error('User account is deactivated')
  return {
    userId: req.user.userId,
    role: user.role,
    organizationId: user.organizationId,
    ...(user.managerAccess ? { managerAccess: user.managerAccess } : {})
  }
}
```

- [ ] **Step 2: Sale create/refund**

Before create: `await assertShopInScope(...); if (!canSell(actor, true)) throw ...`  
Before refund: load sale.shopId, assert scope + `canRefund`.

- [ ] **Step 3: Expense create** — `canAddExpense` + shop scope

- [ ] **Step 4: Inventory update/adjust/bulk** — `canAddStock` + shop scope (STAFF denied)

- [ ] **Step 5: Purchase create** — `canPurchase` + shop scope (STAFF denied)

- [ ] **Step 6: Receipt get/download** — `canDownloadReceipt` + shop scope via receipt.shopId

- [ ] **Step 7: Cashflow summary/entries** — `canViewShopFinance` + shop scope

Return **403** for permission/scope failures.

- [ ] **Step 8: Add focused unit tests for controller guard helpers if extracted; otherwise service-level assert tests**

- [ ] **Step 9: Commit**

```bash
git add src/modules/sale src/modules/expense src/modules/inventory src/modules/purchase src/modules/receipt src/routes src/modules/auth/assertActor.ts
git commit -m "feat(auth): enforce role and shop scope on operational APIs"
```

---
