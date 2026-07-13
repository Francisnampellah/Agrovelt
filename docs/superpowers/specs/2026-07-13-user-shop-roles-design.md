# User Management, Shop Scoping & Manager Role — Design

**Date:** 2026-07-13  
**Status:** Approved for implementation (pending final spec review)  
**Scope:** Backend user management, roles, shop association, and access enforcement

## Problem

Today:

- Prisma roles are `SUPER_ADMIN | ADMIN | OWNER | STAFF` only — no `MANAGER`.
- `ShopStaff` exists and allows multi-shop membership, but nothing reliably creates or enforces it.
- Staff can effectively see org-wide shops; shop-scoped middleware is unused.
- Firebase token exchange can overwrite intentional roles (e.g. STAFF → OWNER).

Needed:

- **STAFF** bound to exactly one shop; can only see/act on that shop.
- **MANAGER** assignable by OWNER to either one shop or all organization shops.
- Clear permission split between OWNER / MANAGER / STAFF.
- User management (create/update/assign/deactivate) is **OWNER-only** within an org.

## Goals

1. Add platform role `MANAGER`.
2. Enforce single-shop association for `STAFF`.
3. Let OWNER choose manager access: one shop **or** all org shops.
4. Enforce shop/org scope on relevant APIs.
5. Keep `ADMIN` / `SUPER_ADMIN` as platform roles (unchanged privilege model at platform level).

## Non-goals

- Full fine-grained permission matrix / ACL UI.
- Changing Firebase global roles beyond preserving Agrovet-assigned MANAGER/STAFF when already set.
- Mobile UI implementation (API contract only; clients consume `shopScope`).

## Roles & permissions

| Capability | OWNER | MANAGER | STAFF |
|---|---|---|---|
| User management (create/update/deactivate, assign scope) | Yes | No | No |
| Add org funding | Yes | Yes — **only if `ALL_SHOPS`** | No |
| Add stock | Yes (any shop) | Yes (shops in scope) | No |
| Purchase from Mnyama Shop | Yes | Yes (shops in scope) | No |
| Generate reports | Yes (org) | Yes (org if `ALL_SHOPS`, else scoped shop) | No |
| Sell | Yes | Yes (in scope) | Yes (their shop) |
| Refund | Yes | Yes (in scope) | Yes (their shop) |
| Add expense | Yes | Yes (in scope) | Yes (their shop) |
| View shop finance & stock | Yes | Yes (in scope) | Yes (their shop) |
| Download receipt | Yes | Yes (in scope) | Yes (their shop) |

### Manager funding rule (resolved)

- Org funding is an org-level action.
- **OWNER** always can add funding.
- **MANAGER** can add funding only when `managerAccess = ALL_SHOPS`.
- One-shop managers cannot add org funding.

## Data model

### 1. Extend `Role` enum

```prisma
enum Role {
  SUPER_ADMIN
  ADMIN
  OWNER
  MANAGER
  STAFF
}
```

Migration: `ALTER TYPE "Role" ADD VALUE 'MANAGER';`

### 2. Manager access enum + optional fields on `User`

```prisma
enum ManagerAccess {
  ONE_SHOP
  ALL_SHOPS
}

model User {
  // existing fields...
  role             Role
  managerAccess    ManagerAccess?  // required when role = MANAGER; null otherwise
  // organizationId remains required for OWNER/MANAGER/STAFF
}
```

Rules:

- `role = MANAGER` → `managerAccess` must be set.
- `role != MANAGER` → `managerAccess` must be null.
- `role = STAFF` → exactly one `ShopStaff` row.
- `role = MANAGER` + `ONE_SHOP` → exactly one `ShopStaff` row.
- `role = MANAGER` + `ALL_SHOPS` → zero `ShopStaff` rows required (org-wide); optional rows ignored for authz (scope = all org shops).
- `role = OWNER` → no shop restriction; may own shops via `Shop.ownerId`.

### 3. Keep `ShopStaff`

```prisma
model ShopStaff {
  id     String @id @default(uuid())
  shopId String
  userId String
  role   String // optional title label (e.g. CASHIER); not used for platform authz
  @@unique([shopId, userId])
}
```

Service-layer uniqueness rules (not only DB unique):

- STAFF: at most one row total per user.
- MANAGER ONE_SHOP: at most one row total per user.
- Reject assigning STAFF/ONE_SHOP manager to a second shop.

## Auth & identity

### Profile / login response

Extend profile (and exchange response) with:

```json
{
  "role": "MANAGER",
  "managerAccess": "ONE_SHOP",
  "organizationId": "...",
  "shopScope": [
    { "shopId": "...", "name": "..." }
  ]
}
```

- STAFF: `shopScope.length === 1`.
- MANAGER `ONE_SHOP`: `shopScope.length === 1`.
- MANAGER `ALL_SHOPS` / OWNER: `shopScope` = all shops in org (or empty array + `allShops: true` flag — prefer explicit `allShops: true` plus full list when cheap).

Recommended response shape:

```json
{
  "role": "MANAGER",
  "managerAccess": "ALL_SHOPS",
  "allShops": true,
  "shopScope": [ /* all org shops */ ]
}
```

### Firebase exchange

- Do **not** overwrite an existing Agrovet `STAFF` or `MANAGER` role with Firebase `agrovet → OWNER` mapping.
- New users without prior Agrovet role continue current mapping (agrovet → OWNER) unless OWNER creates them intentionally as STAFF/MANAGER via user APIs.
- Prefer: if local user already exists with STAFF/MANAGER, preserve role + shop links; only sync email/name/firebaseUid.

## APIs

### Owner-only user management (org-scoped)

New/adjusted endpoints under org or users module (OWNER of that org, or SUPER_ADMIN/ADMIN as platform):

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/organizations/:orgId/users` | Create user (`STAFF` or `MANAGER`) with shop/access assignment |
| `GET` | `/api/organizations/:orgId/users` | List org users + shopScope |
| `PATCH` | `/api/organizations/:orgId/users/:userId` | Update role/access/shop assignment (OWNER only) |
| `POST` | `/api/organizations/:orgId/users/:userId/deactivate` | Deactivate |

Create body examples:

```json
{
  "name": "Amina",
  "email": "amina@example.com",
  "password": "...",
  "role": "STAFF",
  "shopId": "shop-uuid"
}
```

```json
{
  "name": "John",
  "email": "john@example.com",
  "password": "...",
  "role": "MANAGER",
  "managerAccess": "ONE_SHOP",
  "shopId": "shop-uuid"
}
```

```json
{
  "name": "Mary",
  "email": "mary@example.com",
  "password": "...",
  "role": "MANAGER",
  "managerAccess": "ALL_SHOPS"
}
```

Validation:

- STAFF requires `shopId`; rejects `managerAccess`.
- MANAGER requires `managerAccess`.
- MANAGER `ONE_SHOP` requires `shopId`.
- MANAGER `ALL_SHOPS` rejects `shopId` (or ignores it with clear API error — prefer reject).
- Shop must belong to the organization.
- Only OWNER of org (or platform ADMIN/SUPER_ADMIN) may call these.

Existing `POST /api/users` (ADMIN-only global) remains for platform admins; org owners use org-scoped routes.

### Access enforcement

Introduce shared helper, e.g. `AccessService.resolveShopIds(user)` and `assertShopInScope(user, shopId)`.

Wire into:

- List shops → filter to `shopScope` for STAFF / ONE_SHOP manager; full org for OWNER / ALL_SHOPS manager.
- Sales, expenses, receipts, inventory reads/writes → require `shopId` in scope.
- Stock add / purchase → MANAGER/OWNER with shop in scope.
- Org funding → OWNER, or MANAGER with `ALL_SHOPS`.
- Reports → OWNER full; MANAGER ALL_SHOPS full org; MANAGER ONE_SHOP / STAFF shop-only where applicable (STAFF: no report generation per permissions table).
- Mount `requireShopAccess` (updated for MANAGER/OWNER rules) on shop-scoped mutating routes.

## Permission helper matrix (implementation)

Centralize checks in one module (`src/modules/auth/permissions.ts` or similar):

- `canManageUsers(user)`
- `canAddOrgFunding(user)`
- `canAddStock(user, shopId)`
- `canPurchase(user, shopId)`
- `canGenerateReports(user, shopId?)`
- `canSell / canRefund / canAddExpense / canViewShopFinance / canDownloadReceipt(user, shopId)`

Controllers call these instead of ad-hoc role strings.

## Migration / rollout

1. Schema migration for `Role.MANAGER`, `ManagerAccess`, `User.managerAccess`.
2. Backfill: existing STAFF with multiple `ShopStaff` rows — keep the first by `createdAt`/`id`, remove extras, log for ops (or fail migration with report if any multi-shop STAFF exist). Prefer soft fail + script if production data unknown.
3. Deploy API + enforcement.
4. Clients read `shopScope` / `allShops` and hide user-management UI for non-owners.

## Testing

- STAFF create without shopId → 400.
- STAFF create with shopId → one ShopStaff; second shop assign → 400.
- MANAGER ALL_SHOPS create → no ShopStaff; can funding; can stock any org shop.
- MANAGER ONE_SHOP → cannot funding; can stock only assigned shop; denied other shop.
- OWNER can create/list/deactivate users; MANAGER/STAFF cannot.
- STAFF sale on other shop → 403.
- Firebase exchange preserves STAFF/MANAGER.
- Shop list returns only scoped shops for STAFF.

## Open items closed in this spec

- Manager funding: ALL_SHOPS managers + owners only.
- MANAGER is a platform `User.role`, not only a ShopStaff title string.
- STAFF is single-shop only.

## Out of scope follow-ups

- Invite-by-email magic links.
- Shop-local titles (`ShopStaff.role`) driving permissions.
- Hierarchy between ADMIN and OWNER for org user APIs beyond platform bypass.
