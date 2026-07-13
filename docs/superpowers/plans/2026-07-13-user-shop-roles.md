# User Management, Shop Scoping & Manager Role — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `MANAGER` role, bind STAFF to exactly one shop, let OWNER assign managers to one shop or all org shops, and enforce shop/org permissions across APIs.

**Architecture:** Extend Prisma `Role` + `User.managerAccess`, centralize authz in `permissions.ts` + `shopScope.ts`, add OWNER-only org user CRUD that creates `ShopStaff` links, then wire scope checks into shops/sales/inventory/purchase/expense/cashflow/receipt routes. Preserve STAFF/MANAGER on Firebase exchange.

**Tech Stack:** Express, Prisma 5, PostgreSQL, Node test runner (`node --test` + `ts-node/register`), existing AuthMiddleware patterns.

**Spec:** `docs/superpowers/specs/2026-07-13-user-shop-roles-design.md`

## Global Constraints

- STAFF → exactly one `ShopStaff` row; interact only with that shop.
- MANAGER → `managerAccess` is `ONE_SHOP` (one ShopStaff) or `ALL_SHOPS` (org-wide).
- OWNER → full org; only OWNER (or platform ADMIN/SUPER_ADMIN) manages users.
- Org funding → OWNER, or MANAGER with `ALL_SHOPS` only.
- STAFF may sell, refund, expense, view finance/stock, download receipt for their shop only.
- MANAGER may add stock, purchase (Mnyama), expense, reports, sell/refund in scope; funding only if ALL_SHOPS.
- Do not overwrite existing STAFF/MANAGER roles during Firebase exchange.
- Prefer `exactOptionalPropertyTypes`-safe object spreads (omit optional keys instead of passing `undefined`).
- Tests: `node --require ts-node/register --test "src/**/*.test.ts"` (update `package.json` test script if needed to include new files).

## File map

| File | Responsibility |
|------|----------------|
| `prisma/schema.prisma` | `Role.MANAGER`, `ManagerAccess`, `User.managerAccess` |
| `prisma/migrations/...` | SQL migration |
| `src/modules/auth/permissions.ts` | Capability checks |
| `src/modules/auth/shopScope.ts` | Resolve `shopScope` / `allShops` for a user |
| `src/modules/auth/types.ts` | Request/response types for scope + managerAccess |
| `src/modules/auth/auth.service.ts` | Profile/exchange preserve roles; scope payload |
| `src/modules/auth/auth.middleware.ts` | Update `requireShopAccess` for MANAGER/OWNER/platform |
| `src/modules/organizations/org-users.service.ts` | OWNER user create/list/patch/deactivate |
| `src/modules/organizations/org-users.controller.ts` | HTTP validation + handlers |
| `src/routes/organizations.ts` | Mount `/organizations/:orgId/users*` |
| `src/modules/shops/shop.controller.ts` | Filter shops by scope |
| Controllers for sale/expense/inventory/purchase/cashflow/receipt | Call permission + shop scope asserts |
| `src/modules/cashflow/*` | Org funding endpoint (ADJUSTMENT IN) |
| `*.test.ts` | Unit tests for permissions, scope, org-users, exchange preserve |

---

### Task 1: Schema — MANAGER role + managerAccess

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260713120000_add_manager_role_and_access/migration.sql`
- Test: `src/modules/auth/permissions.test.ts` (created empty-ready in Task 2; this task only verifies migrate/generate)

**Interfaces:**
- Produces: Prisma enum `Role.MANAGER`, enum `ManagerAccess { ONE_SHOP ALL_SHOPS }`, field `User.managerAccess ManagerAccess?`

- [ ] **Step 1: Update Prisma schema**

In `prisma/schema.prisma`, change Role enum to:

```prisma
enum Role {
  SUPER_ADMIN
  ADMIN
  OWNER
  MANAGER
  STAFF
}

enum ManagerAccess {
  ONE_SHOP
  ALL_SHOPS
}
```

On `model User`, add after `role`:

```prisma
  managerAccess  ManagerAccess?
```

- [ ] **Step 2: Add migration SQL**

Create `prisma/migrations/20260713120000_add_manager_role_and_access/migration.sql`:

```sql
-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MANAGER';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ManagerAccess" AS ENUM ('ONE_SHOP', 'ALL_SHOPS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "managerAccess" "ManagerAccess";
```

- [ ] **Step 3: Generate client**

Run: `npx prisma generate`  
Expected: success, client includes `MANAGER` and `ManagerAccess`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260713120000_add_manager_role_and_access
git commit -m "feat(auth): add MANAGER role and managerAccess to schema"
```

---

### Task 2: Shop scope resolver + permission helpers

**Files:**
- Create: `src/modules/auth/shopScope.ts`
- Create: `src/modules/auth/permissions.ts`
- Create: `src/modules/auth/shopScope.test.ts`
- Create: `src/modules/auth/permissions.test.ts`
- Modify: `src/modules/auth/index.ts` (re-export)
- Modify: `package.json` test script if it does not already include `src/**/*.test.ts`

**Interfaces:**
- Produces:
  - `type AuthActor = { userId: string; role: string; organizationId?: string | null; managerAccess?: 'ONE_SHOP' | 'ALL_SHOPS' | null }`
  - `type ShopScopeResult = { allShops: boolean; shopIds: string[]; shops: { shopId: string; name: string }[] }`
  - `resolveShopScope(prisma, actor): Promise<ShopScopeResult>`
  - `assertShopInScope(prisma, actor, shopId): Promise<void>`
  - `canManageUsers(actor): boolean`
  - `canAddOrgFunding(actor): boolean`
  - `canAddStock(actor, shopInScope: boolean): boolean`
  - `canPurchase(actor, shopInScope: boolean): boolean`
  - `canGenerateReports(actor, { allShopsScope: boolean }): boolean`
  - `canSell|canRefund|canAddExpense|canViewShopFinance|canDownloadReceipt(actor, shopInScope: boolean): boolean`

- [ ] **Step 1: Write failing permissions tests**

Create `src/modules/auth/permissions.test.ts`:

```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canManageUsers,
  canAddOrgFunding,
  canAddStock,
  canPurchase,
  canGenerateReports,
  canSell,
  canRefund,
  canAddExpense,
  canViewShopFinance,
  canDownloadReceipt
} from './permissions'

test('only OWNER (and platform admins) can manage users', () => {
  assert.equal(canManageUsers({ userId: '1', role: 'OWNER' }), true)
  assert.equal(canManageUsers({ userId: '1', role: 'ADMIN' }), true)
  assert.equal(canManageUsers({ userId: '1', role: 'SUPER_ADMIN' }), true)
  assert.equal(canManageUsers({ userId: '1', role: 'MANAGER', managerAccess: 'ALL_SHOPS' }), false)
  assert.equal(canManageUsers({ userId: '1', role: 'STAFF' }), false)
})

test('org funding allowed for OWNER and ALL_SHOPS manager only', () => {
  assert.equal(canAddOrgFunding({ userId: '1', role: 'OWNER' }), true)
  assert.equal(canAddOrgFunding({ userId: '1', role: 'MANAGER', managerAccess: 'ALL_SHOPS' }), true)
  assert.equal(canAddOrgFunding({ userId: '1', role: 'MANAGER', managerAccess: 'ONE_SHOP' }), false)
  assert.equal(canAddOrgFunding({ userId: '1', role: 'STAFF' }), false)
})

test('staff shop ops require shopInScope', () => {
  const staff = { userId: '1', role: 'STAFF' }
  assert.equal(canSell(staff, true), true)
  assert.equal(canSell(staff, false), false)
  assert.equal(canRefund(staff, true), true)
  assert.equal(canAddExpense(staff, true), true)
  assert.equal(canViewShopFinance(staff, true), true)
  assert.equal(canDownloadReceipt(staff, true), true)
  assert.equal(canAddStock(staff, true), false)
  assert.equal(canPurchase(staff, true), false)
  assert.equal(canGenerateReports(staff, { allShopsScope: false }), false)
})

test('manager can stock/purchase/report in scope', () => {
  const one = { userId: '1', role: 'MANAGER', managerAccess: 'ONE_SHOP' as const }
  const all = { userId: '1', role: 'MANAGER', managerAccess: 'ALL_SHOPS' as const }
  assert.equal(canAddStock(one, true), true)
  assert.equal(canAddStock(one, false), false)
  assert.equal(canPurchase(all, true), true)
  assert.equal(canGenerateReports(one, { allShopsScope: false }), true)
  assert.equal(canGenerateReports(all, { allShopsScope: true }), true)
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node --require ts-node/register --test src/modules/auth/permissions.test.ts`  
Expected: FAIL (module not found / exports missing).

- [ ] **Step 3: Implement permissions.ts**

Create `src/modules/auth/permissions.ts`:

```typescript
export type AuthActor = {
  userId: string
  role: string
  organizationId?: string | null
  managerAccess?: 'ONE_SHOP' | 'ALL_SHOPS' | null
}

function isPlatformAdmin(actor: AuthActor): boolean {
  return actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN'
}

export function canManageUsers(actor: AuthActor): boolean {
  return actor.role === 'OWNER' || isPlatformAdmin(actor)
}

export function canAddOrgFunding(actor: AuthActor): boolean {
  if (actor.role === 'OWNER' || isPlatformAdmin(actor)) return true
  return actor.role === 'MANAGER' && actor.managerAccess === 'ALL_SHOPS'
}

export function canAddStock(actor: AuthActor, shopInScope: boolean): boolean {
  if (!shopInScope) return false
  if (actor.role === 'OWNER' || isPlatformAdmin(actor)) return true
  return actor.role === 'MANAGER'
}

export function canPurchase(actor: AuthActor, shopInScope: boolean): boolean {
  return canAddStock(actor, shopInScope)
}

export function canGenerateReports(
  actor: AuthActor,
  opts: { allShopsScope: boolean }
): boolean {
  if (actor.role === 'OWNER' || isPlatformAdmin(actor)) return true
  if (actor.role !== 'MANAGER') return false
  if (actor.managerAccess === 'ALL_SHOPS') return true
  return !opts.allShopsScope
}

function shopOpsAllowed(actor: AuthActor, shopInScope: boolean): boolean {
  if (!shopInScope) return false
  return (
    actor.role === 'OWNER' ||
    actor.role === 'MANAGER' ||
    actor.role === 'STAFF' ||
    isPlatformAdmin(actor)
  )
}

export const canSell = shopOpsAllowed
export const canRefund = shopOpsAllowed
export const canAddExpense = shopOpsAllowed
export const canViewShopFinance = shopOpsAllowed
export const canDownloadReceipt = shopOpsAllowed
```

- [ ] **Step 4: Write failing shopScope tests**

Create `src/modules/auth/shopScope.test.ts` with an in-memory prisma stub that returns org shops / staffIn / owned shops, covering:
- STAFF → only staff shop
- MANAGER ONE_SHOP → only staff shop
- MANAGER ALL_SHOPS → all org shops, `allShops: true`
- OWNER → all org shops, `allShops: true`
- `assertShopInScope` throws when out of scope

Example STAFF case:

```typescript
test('STAFF scope is exactly assigned shop', async () => {
  const prisma = {
    user: {
      findUnique: async () => ({
        id: 'u1',
        role: 'STAFF',
        organizationId: 'org1',
        managerAccess: null,
        staffIn: [{ shop: { id: 's1', name: 'Main' } }],
        shopsOwned: []
      })
    },
    shop: {
      findMany: async () => [{ id: 's1', name: 'Main' }, { id: 's2', name: 'Branch' }]
    }
  }
  const { resolveShopScope } = await import('./shopScope')
  const scope = await resolveShopScope(prisma as never, { userId: 'u1', role: 'STAFF', organizationId: 'org1' })
  assert.equal(scope.allShops, false)
  assert.deepEqual(scope.shopIds, ['s1'])
})
```

- [ ] **Step 5: Implement shopScope.ts**

```typescript
import { PrismaClient } from '@prisma/client'
import { AuthActor } from './permissions'

export type ShopScopeResult = {
  allShops: boolean
  shopIds: string[]
  shops: { shopId: string; name: string }[]
}

type Db = PrismaClient | any

export async function resolveShopScope(prisma: Db, actor: AuthActor): Promise<ShopScopeResult> {
  if (actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN') {
    return { allShops: true, shopIds: [], shops: [] }
  }

  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: {
      role: true,
      organizationId: true,
      managerAccess: true,
      shopsOwned: { select: { id: true, name: true } },
      staffIn: { select: { shop: { select: { id: true, name: true } } } }
    }
  })
  if (!user) throw new Error('User not found')

  const allShopsAccess =
    user.role === 'OWNER' ||
    (user.role === 'MANAGER' && user.managerAccess === 'ALL_SHOPS')

  if (allShopsAccess) {
    if (!user.organizationId) {
      return { allShops: true, shopIds: [], shops: [] }
    }
    const orgShops = await prisma.shop.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })
    return {
      allShops: true,
      shopIds: orgShops.map((s: { id: string }) => s.id),
      shops: orgShops.map((s: { id: string; name: string }) => ({ shopId: s.id, name: s.name }))
    }
  }

  const fromStaff = user.staffIn.map((s: { shop: { id: string; name: string } }) => ({
    shopId: s.shop.id,
    name: s.shop.name
  }))
  const fromOwned = user.shopsOwned.map((s: { id: string; name: string }) => ({
    shopId: s.id,
    name: s.name
  }))
  const map = new Map<string, { shopId: string; name: string }>()
  for (const s of [...fromOwned, ...fromStaff]) map.set(s.shopId, s)
  const shops = [...map.values()]
  return { allShops: false, shopIds: shops.map(s => s.shopId), shops }
}

export async function assertShopInScope(prisma: Db, actor: AuthActor, shopId: string): Promise<void> {
  if (actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN') return
  const scope = await resolveShopScope(prisma, actor)
  if (scope.allShops && scope.shopIds.length === 0 && actor.organizationId) {
    // platform already returned; org allShops has ids — if empty list with allShops, re-check membership
  }
  if (!scope.shopIds.includes(shopId)) {
    throw new Error('Access denied to this shop')
  }
}
```

Fix `assertShopInScope` so ADMIN/SUPER_ADMIN pass; OWNER/ALL_SHOPS manager pass iff shop belongs to their org (verify via `shop.organizationId === user.organizationId` when `allShops`).

- [ ] **Step 6: Run tests — expect PASS**

Run: `node --require ts-node/register --test src/modules/auth/permissions.test.ts src/modules/auth/shopScope.test.ts`  
Expected: all PASS.

- [ ] **Step 7: Export from auth index and commit**

```bash
git add src/modules/auth/permissions.ts src/modules/auth/shopScope.ts src/modules/auth/permissions.test.ts src/modules/auth/shopScope.test.ts src/modules/auth/index.ts package.json
git commit -m "feat(auth): add shop scope resolver and permission helpers"
```

---

### Task 3: Org user management service (OWNER creates STAFF/MANAGER)

**Files:**
- Create: `src/modules/organizations/org-users.service.ts`
- Create: `src/modules/organizations/org-users.service.test.ts`
- Modify: `src/modules/organizations/types.ts` (add request types)

**Interfaces:**
- Consumes: `canManageUsers`, Prisma User/ShopStaff
- Produces:
  - `createOrgUser(actor, orgId, input)`
  - `listOrgUsers(orgId)`
  - `updateOrgUser(actor, orgId, userId, input)`
  - `deactivateOrgUser(actor, orgId, userId)`
  - Input type:
```typescript
export type CreateOrgUserInput = {
  name: string
  email: string
  password: string
  role: 'STAFF' | 'MANAGER'
  managerAccess?: 'ONE_SHOP' | 'ALL_SHOPS'
  shopId?: string
}
```

- [ ] **Step 1: Write failing service tests**

Cover:
1. STAFF without shopId → throws `/shopId is required/`
2. STAFF with shopId → user role STAFF, one ShopStaff, managerAccess null
3. MANAGER ALL_SHOPS with shopId → throws
4. MANAGER ONE_SHOP without shopId → throws
5. MANAGER ALL_SHOPS → managerAccess ALL_SHOPS, zero ShopStaff
6. Non-owner actor → throws `/Insufficient permissions/` or `/User management/`
7. Shop outside org → throws

Use bcrypt-compatible stub: inject prisma mock; hash can call real bcrypt or stub `passwordHash: 'hash'`.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement org-users.service.ts**

Key create logic:

```typescript
import bcrypt from 'bcrypt'
import { PrismaClient, Role, ManagerAccess } from '@prisma/client'
import { AuthActor, canManageUsers } from '../auth/permissions'

export class OrgUsersService {
  constructor(private prisma: PrismaClient) {}

  async createOrgUser(actor: AuthActor, orgId: string, input: CreateOrgUserInput) {
    if (!canManageUsers(actor)) throw new Error('Insufficient permissions for user management')
    if (actor.role === 'OWNER' && actor.organizationId !== orgId) {
      throw new Error('Access denied to this organization')
    }

    if (input.role === 'STAFF') {
      if (!input.shopId) throw new Error('shopId is required for STAFF')
      if (input.managerAccess) throw new Error('managerAccess is not allowed for STAFF')
    }
    if (input.role === 'MANAGER') {
      if (!input.managerAccess) throw new Error('managerAccess is required for MANAGER')
      if (input.managerAccess === 'ONE_SHOP' && !input.shopId) {
        throw new Error('shopId is required for ONE_SHOP managers')
      }
      if (input.managerAccess === 'ALL_SHOPS' && input.shopId) {
        throw new Error('shopId is not allowed for ALL_SHOPS managers')
      }
    }

    if (input.shopId) {
      const shop = await this.prisma.shop.findFirst({
        where: { id: input.shopId, organizationId: orgId }
      })
      if (!shop) throw new Error('Shop not found in this organization')
    }

    const passwordHash = await bcrypt.hash(input.password, 10)

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          role: input.role === 'STAFF' ? Role.STAFF : Role.MANAGER,
          organizationId: orgId,
          managerAccess:
            input.role === 'MANAGER'
              ? (input.managerAccess === 'ALL_SHOPS'
                  ? ManagerAccess.ALL_SHOPS
                  : ManagerAccess.ONE_SHOP)
              : null
        }
      })

      if (input.shopId) {
        await tx.shopStaff.create({
          data: {
            shopId: input.shopId,
            userId: user.id,
            role: input.role === 'MANAGER' ? 'MANAGER' : 'STAFF'
          }
        })
      }

      return user
    })
  }
}
```

Also implement `listOrgUsers` (include staffIn.shop + managerAccess), `updateOrgUser` (reassign shop / managerAccess with same validation; when switching to ALL_SHOPS delete ShopStaff rows; when STAFF/ONE_SHOP ensure single row), `deactivateOrgUser` (`isActive: false`).

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/organizations/org-users.service.ts src/modules/organizations/org-users.service.test.ts src/modules/organizations/types.ts
git commit -m "feat(org): add owner-scoped user create/list/update/deactivate service"
```

---

### Task 4: Org user HTTP routes + controller

**Files:**
- Create: `src/modules/organizations/org-users.controller.ts`
- Modify: `src/modules/organizations/index.ts`
- Modify: `src/routes/organizations.ts`
- Modify: `src/modules/organizations/organization.swagger.ts` (document endpoints)

**Interfaces:**
- Consumes: `OrgUsersService`, `AuthMiddleware.authenticate`
- Produces routes:
  - `POST /api/organizations/:id/users`
  - `GET /api/organizations/:id/users`
  - `PATCH /api/organizations/:id/users/:userId`
  - `POST /api/organizations/:id/users/:userId/deactivate`

- [ ] **Step 1: Implement controller with express-validator**

Validation highlights:
- `role` isIn `['STAFF','MANAGER']`
- `managerAccess` optional isIn `['ONE_SHOP','ALL_SHOPS']`
- `shopId` optional UUID
- `password` isLength min 8

Build `AuthActor` from `req.user` + load `managerAccess` from DB if needed:

```typescript
const dbUser = await prisma.user.findUnique({
  where: { id: req.user!.userId },
  select: { managerAccess: true, organizationId: true }
})
const actor = {
  userId: req.user!.userId,
  role: req.user!.role,
  organizationId: req.user!.organizationId ?? dbUser?.organizationId,
  ...(dbUser?.managerAccess ? { managerAccess: dbUser.managerAccess } : {})
}
```

Map errors: permission → 403, not found → 404, validation → 400.

- [ ] **Step 2: Wire routes in `src/routes/organizations.ts`**

Place **before** `/organizations/:id` SUPER_ADMIN routes if path conflicts; use `:id` consistently as orgId:

```typescript
router.post('/organizations/:id/users', authMiddleware.authenticate, orgUsersController.createValidation, orgUsersController.create)
router.get('/organizations/:id/users', authMiddleware.authenticate, orgUsersController.list)
router.patch('/organizations/:id/users/:userId', authMiddleware.authenticate, orgUsersController.updateValidation, orgUsersController.update)
router.post('/organizations/:id/users/:userId/deactivate', authMiddleware.authenticate, orgUsersController.deactivate)
```

- [ ] **Step 3: Manual smoke via unit-level controller not required; ensure TypeScript compiles for new files**

Run: `npx tsc --noEmit 2>&1 | Select-String "org-users"`  
Expected: no org-users errors (ignore pre-existing cors error).

- [ ] **Step 4: Commit**

```bash
git add src/modules/organizations/org-users.controller.ts src/modules/organizations/index.ts src/routes/organizations.ts src/modules/organizations/organization.swagger.ts
git commit -m "feat(org): expose OWNER user management HTTP APIs"
```

---

### Task 5: Profile + Firebase exchange preserve STAFF/MANAGER + rich shopScope

**Files:**
- Modify: `src/modules/auth/types.ts`
- Modify: `src/modules/auth/auth.service.ts`
- Modify: `src/modules/auth/collectorResponse.ts` (if used for client payloads)
- Create: `src/modules/auth/auth.service.exchange.test.ts` (unit test with mocked prisma/firebase if feasible; otherwise test pure preserve helper)

**Interfaces:**
- Produces profile/token user shape:
```typescript
{
  managerAccess?: 'ONE_SHOP' | 'ALL_SHOPS' | null
  allShops: boolean
  shopScope: { shopId: string; name: string }[] // prefer objects; if breaking clients, also keep string[] ids under shopScopeIds
}
```
- Prefer additive: keep `shopScope` as id string[] for backward compat AND add `shops: {shopId,name}[]` + `allShops` + `managerAccess`.

- [ ] **Step 1: Extract preserve helper and test it**

```typescript
// in auth.service.ts or firebaseRoleMapping.ts
export function shouldPreserveLocalRole(localRole: string): boolean {
  return localRole === 'STAFF' || localRole === 'MANAGER'
}
```

Test: `shouldPreserveLocalRole('STAFF') === true`, `'OWNER' === false`.

- [ ] **Step 2: Change exchange update branch**

Replace overwrite logic:

```typescript
} else {
  const data: { firebaseUid?: string; role?: Role } = {}
  if (!user.firebaseUid) data.firebaseUid = uid
  if (!shouldPreserveLocalRole(user.role) && user.role !== localRole) {
    data.role = localRole
  }
  if (Object.keys(data).length > 0) {
    user = await this.prisma.user.update({
      where: { id: user.id },
      data,
      include: { shopsOwned: { select: { id: true } }, staffIn: { select: { shopId: true } } }
    })
  }
}
```

- [ ] **Step 3: Update getProfile / token response to use resolveShopScope**

Include `managerAccess`, `allShops`, and shop list from `resolveShopScope`.

- [ ] **Step 4: Run auth tests + commit**

```bash
git add src/modules/auth
git commit -m "fix(auth): preserve STAFF/MANAGER on exchange and return shop scope"
```

---

### Task 6: Update requireShopAccess + filter shop lists

**Files:**
- Modify: `src/modules/auth/auth.middleware.ts`
- Modify: `src/modules/shops/shop.controller.ts`
- Modify: `src/modules/organizations/organization.controller.ts` (`getShops`, stock/sales/expenses if they list org-wide)

- [ ] **Step 1: Rewrite requireShopAccess**

Use `assertShopInScope` after loading actor `managerAccess` from DB. Allow SUPER_ADMIN and ADMIN. For OWNER/MANAGER ALL_SHOPS ensure shop.organizationId matches user.organizationId.

- [ ] **Step 2: Filter `ShopController.getAll`**

After fetching org shops, if role is STAFF or MANAGER ONE_SHOP, filter to `resolveShopScope.shopIds`.

- [ ] **Step 3: Filter org `getShops` similarly**

- [ ] **Step 4: Commit**

```bash
git add src/modules/auth/auth.middleware.ts src/modules/shops/shop.controller.ts src/modules/organizations/organization.controller.ts
git commit -m "feat(auth): enforce shop scope on shop access and listings"
```

---

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

### Task 8: Org funding endpoint

**Files:**
- Modify: `src/modules/cashflow/cashflow.service.ts`
- Modify: `src/routes/cashflow.ts`
- Create: `src/modules/cashflow/funding.test.ts` (service permission integration with mock)

Spec: OWNER or MANAGER ALL_SHOPS records funding as cash IN / ADJUSTMENT against a chosen shop (use main shop or body `shopId` that must be in org). Funding is org-level capability; still needs a shopId for `CashFlowEntry` FK.

- [ ] **Step 1: Add `recordFunding(shopId, amount, recordedBy, note?)`**

Uses direction `IN`, category `ADJUSTMENT`, note default `Organization funding`.

- [ ] **Step 2: Route `POST /api/cashflow/funding`**

Body: `{ shopId, amount, note? }`  
Check `canAddOrgFunding(actor)` then `assertShopInScope` (OWNER/ALL_SHOPS always in scope for org shops).

- [ ] **Step 3: Test ONE_SHOP manager denied; ALL_SHOPS allowed**

- [ ] **Step 4: Commit**

```bash
git add src/modules/cashflow src/routes/cashflow.ts
git commit -m "feat(cashflow): add org funding endpoint with manager ALL_SHOPS gate"
```

---

### Task 9: Register validation + swagger + STAFF multi-shop cleanup note

**Files:**
- Modify: `src/modules/auth/auth.controller.ts` (allow MANAGER in role isIn if register still accepts role — prefer **reject** public register creating MANAGER; only org user API creates MANAGER/STAFF with shop)
- Modify: `src/config/swagger.ts` Role enums
- Optional script: `scripts/audit-multi-shop-staff.ts` listing STAFF with >1 ShopStaff

- [ ] **Step 1: Restrict public register**

Public `POST /api/auth/register` must not create MANAGER. If role STAFF without shopId, either reject or keep legacy but log deprecation — **prefer reject STAFF without shopId** on register; owners use org user API.

- [ ] **Step 2: Update swagger Role enum to include MANAGER + document org user endpoints**

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/auth.controller.ts src/config/swagger.ts scripts/audit-multi-shop-staff.ts
git commit -m "docs(auth): document MANAGER role and tighten public register"
```

---

### Task 10: End-to-end verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`  
Expected: all PASS including new auth/org/cashflow tests.

- [ ] **Step 2: Confirm prisma generate + migration present**

- [ ] **Step 3: Manual checklist (document in commit message if no e2e harness)**

1. OWNER creates STAFF with shopId → profile shopScope length 1  
2. STAFF cannot list other shops / cannot purchase / cannot add stock  
3. OWNER creates MANAGER ALL_SHOPS → funding OK  
4. OWNER creates MANAGER ONE_SHOP → funding 403; stock on other shop 403  
5. Exchange as existing STAFF does not become OWNER  

- [ ] **Step 4: Final commit if any fixes**

```bash
git add -A
git commit -m "test(auth): verify role and shop scoping coverage"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Role.MANAGER + ManagerAccess | Task 1 |
| Permission matrix helpers | Task 2 |
| STAFF single shop / MANAGER one or all | Task 3 |
| OWNER-only org user APIs | Task 3–4 |
| Profile/exchange shopScope + preserve roles | Task 5 |
| Shop list filtering + requireShopAccess | Task 6 |
| Sell/refund/expense/stock/purchase/receipt/finance gates | Task 7 |
| Org funding ALL_SHOPS/OWNER | Task 8 |
| Docs/swagger/register tightening | Task 9 |
| Verification | Task 10 |

## Placeholder scan

No TBD/TODO placeholders in task steps. Code samples are concrete; adjust only for `exactOptionalPropertyTypes` spreads when copying.
