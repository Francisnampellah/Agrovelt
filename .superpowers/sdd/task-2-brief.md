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
