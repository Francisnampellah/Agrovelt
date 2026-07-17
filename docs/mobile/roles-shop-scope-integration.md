# Mobile App Integration Guide — Roles, Shop Scope & Sales Stock

**Date:** 2026-07-13  
**Branch:** `feat/user-shop-roles`  
**Audience:** Agrovet mobile app engineers

This document describes backend changes the mobile app must adopt for:

1. New **MANAGER** role and shop scoping  
2. **OWNER-only** user management  
3. Permission differences between OWNER / MANAGER / STAFF  
4. Related sales stock targeting via **`inventoryId`** (already on backend)

---

## 1. Roles overview

| Role | Shop access | Who creates them |
|------|-------------|------------------|
| `OWNER` | All shops in their organization | Org creation / public register (OWNER/ADMIN/SUPER_ADMIN only) |
| `MANAGER` | One shop **or** all org shops (OWNER chooses) | OWNER via org user APIs only |
| `STAFF` | Exactly **one** shop | OWNER via org user APIs only |
| `ADMIN` / `SUPER_ADMIN` | Platform-level | Platform only |

**Important**

- Public `POST /api/auth/register` and `POST /api/users` **cannot** create `STAFF` or `MANAGER`.
- Create staff/managers with `POST /api/organizations/{orgId}/users` (OWNER only).

### Manager access field

When `role === "MANAGER"`, the user has:

| `managerAccess` | Meaning |
|-----------------|--------|
| `ONE_SHOP` | Linked to exactly one shop |
| `ALL_SHOPS` | Can act across all shops in the organization |

`STAFF` and `OWNER` have `managerAccess: null`.

---

## 2. Auth / profile payload (mobile must parse this)

After Firebase exchange / login-style responses that use the collector format, `user` now includes:

```json
{
  "id": "user-uuid",
  "name": "Amina",
  "email": "amina@example.com",
  "role": "MANAGER",
  "organizationId": "org-uuid",
  "isActive": true,
  "managerAccess": "ONE_SHOP",
  "allShops": false,
  "shopScope": ["shop-uuid-1"],
  "shops": [
    { "shopId": "shop-uuid-1", "name": "Main Branch" }
  ]
}
```

### Field meanings

| Field | Type | Use on mobile |
|-------|------|----------------|
| `role` | string | Drive menus / feature flags |
| `managerAccess` | `"ONE_SHOP"` \| `"ALL_SHOPS"` \| `null` | Only meaningful for MANAGER |
| `allShops` | boolean | `true` for OWNER and MANAGER with `ALL_SHOPS` |
| `shopScope` | `string[]` | Allowed shop IDs (backward compatible) |
| `shops` | `{ shopId, name }[]` | Preferred for UI shop pickers |

### Expected values by role

| Role | `allShops` | `shops` / `shopScope` |
|------|------------|------------------------|
| `OWNER` | `true` | All org shops |
| `MANAGER` + `ALL_SHOPS` | `true` | All org shops |
| `MANAGER` + `ONE_SHOP` | `false` | Exactly one shop |
| `STAFF` | `false` | Exactly one shop |

### Mobile actions after login / exchange

1. Persist `role`, `managerAccess`, `allShops`, `shopScope`, `shops`.
2. If `allShops === false` and `shops.length === 1`, **auto-select** that shop and hide shop switcher (or lock it).
3. Never send requests for a `shopId` outside `shopScope` — backend returns **403**.
4. Refresh profile/`exchange` after OWNER changes a user’s shop assignment.

---

## 3. Permission matrix (UI feature flags)

Use this to show/hide screens and actions.

| Capability | OWNER | MANAGER (`ALL_SHOPS`) | MANAGER (`ONE_SHOP`) | STAFF |
|------------|:-----:|:---------------------:|:--------------------:|:-----:|
| User management | Yes | No | No | No |
| Add org funding | Yes | Yes | No | No |
| Add stock | Yes | Yes (any org shop) | Yes (assigned shop) | No |
| Purchase (Mnyama / purchases API) | Yes | Yes (in scope) | Yes (assigned shop) | No |
| Org / shop reports | Yes | Yes (org-wide) | Yes (assigned shop only) | No |
| Sell | Yes | Yes (in scope) | Yes (assigned shop) | Yes (assigned shop) |
| Refund | Yes | Yes (in scope) | Yes (assigned shop) | Yes (assigned shop) |
| Add expense | Yes | Yes (in scope) | Yes (assigned shop) | Yes (assigned shop) |
| View shop finance & stock | Yes | Yes (in scope) | Yes (assigned shop) | Yes (assigned shop) |
| Download / view receipt | Yes | Yes (in scope) | Yes (assigned shop) | Yes (assigned shop) |

### Suggested mobile screens by role

**OWNER**

- Full org dashboard  
- User management  
- Funding  
- Stock / purchase / reports for any shop  

**MANAGER `ALL_SHOPS`**

- Same operational tools as OWNER  
- **Hide** user management  
- Show funding  

**MANAGER `ONE_SHOP`**

- Shop picker locked to assigned shop  
- Stock, purchase, sell, refund, expense, finance, receipts for that shop  
- Reports for that shop only  
- **Hide** funding and user management  

**STAFF**

- Locked to one shop  
- Sell, refund, expense, view stock/finance, receipts  
- **Hide** user management, funding, stock add, purchases, reports  

---

## 4. User management APIs (OWNER, ADMIN, SUPER_ADMIN)

Base path: `/api/organizations/{orgId}/users`  
Auth: Bearer token.

Who can call these:

| Caller | Allowed? |
|--------|----------|
| `OWNER` of that `orgId` | Yes |
| `ADMIN` | Yes (any org) |
| `SUPER_ADMIN` | Yes (any org) |
| `MANAGER` / `STAFF` | No (`403`) |

This is the **invite / register user for org or shop** flow. There is no email magic-link invite yet — the caller creates the account with name, email, password, phone, role, and shop assignment.

On success the backend also provisions Firebase Auth + Firestore so the invitee can sign in on mobile immediately:

1. Firebase Auth user (same email/password)
2. Custom claim `globalRole: "agrovet"`
3. Firestore `users/{uid}` with required fields (see below)
4. Prisma `User.firebaseUid` linked to that uid

The invitee then signs in with Firebase and calls Agrovelt exchange/login.

### 4.1 Create user

`POST /api/organizations/{orgId}/users`

**Create STAFF**

```json
{
  "name": "Amina",
  "email": "amina@example.com",
  "password": "Secret123!",
  "phoneNumber": "0712345678",
  "role": "STAFF",
  "shopId": "shop-uuid"
}
```

Rules:

- `phoneNumber` **required** (min 9 chars; stored on Firestore as `phone_no`)
- `shopId` **required**
- `managerAccess` **not allowed**

**Create MANAGER (one shop)**

```json
{
  "name": "John",
  "email": "john@example.com",
  "password": "Secret123!",
  "phoneNumber": "0712345678",
  "role": "MANAGER",
  "managerAccess": "ONE_SHOP",
  "shopId": "shop-uuid"
}
```

**Create MANAGER (all shops)**

```json
{
  "name": "Mary",
  "email": "mary@example.com",
  "password": "Secret123!",
  "phoneNumber": "0712345678",
  "role": "MANAGER",
  "managerAccess": "ALL_SHOPS"
}
```

Rules:

- `phoneNumber` **required** for every invite  
- `managerAccess` **required** for MANAGER  
- `ALL_SHOPS` → do **not** send `shopId`  
- `ONE_SHOP` → `shopId` **required**  
- Password min length: **8**

Success: `201` with user object (**no** `passwordHash`; includes `firebaseUid`).

**Firestore `users/{uid}` written on invite:**

| Field | Value |
|-------|--------|
| `uid` | Firebase Auth uid |
| `email` | invite email |
| `display_name` | invite `name` |
| `first_name` / `last_name` | split from `name` |
| `phone_no` | from request `phoneNumber` |
| `role` | `"agrovet"` |
| `sign_up_provider` | `"email"` |
| `verification_status` | `"verified"` |
| `on_boarding_complete` | `true` |
| `on_boarding_stage_1` | `true` |
| `collector_registered` | `true` |
| `collector_organization_id` | org id from path |
| `collector_organization_name` | org name |
| `collector_organization_slug` | org slug |
| `face_photo_url` | `""` |
| `gender` | `""` (mobile can update later) |
| `fcmTokens` | `{}` (mobile fills android/ios later) |
| `created_date` | server timestamp |

Custom claim: `globalRole: "agrovet"`.  
Not set on invite (device-owned): `last_fcm_token_update`, real FCM token values.

### 4.2 List users

`GET /api/organizations/{orgId}/users`

Returns org users with `role`, `managerAccess`, `staffIn` / shop assignment info (no password hashes).

### 4.3 Update user

`PATCH /api/organizations/{orgId}/users/{userId}`

Partial update. Same validation rules as create when changing role/access/shop.

Example: promote STAFF → ALL_SHOPS manager:

```json
{
  "role": "MANAGER",
  "managerAccess": "ALL_SHOPS"
}
```

(Switching to `ALL_SHOPS` removes single-shop assignment.)

### 4.4 Deactivate user

`POST /api/organizations/{orgId}/users/{userId}/deactivate`

Sets `isActive: false`.

### Typical errors

| HTTP | Meaning |
|------|---------|
| `400` | Validation / assignment rule failure |
| `403` | Not OWNER / no user-management permission |
| `404` | User or shop not found in org |

---

## 5. Shop listing behavior

`GET /api/shops` and `GET /api/organizations/{orgId}/shops` are filtered by backend scope:

- OWNER / MANAGER `ALL_SHOPS` → all org shops  
- STAFF / MANAGER `ONE_SHOP` → only assigned shop(s)

**Mobile should still prefer `user.shops` from auth** as the source of truth for pickers, then refresh from shop list APIs when needed.

---

## 6. Operational APIs — always send scoped `shopId`

These endpoints enforce shop scope and return **403** if the shop is outside the user’s scope:

| Area | Examples |
|------|----------|
| Sales | create, list, get, refund |
| Expenses | create, list |
| Purchases | create, list |
| Inventory | get by shop, transactions, update/adjust |
| Receipts | list/get by shop |
| Cashflow | summary, entries |

Also:

- Inventory **update/adjust** and purchases are denied for **STAFF** (`403`).
- Org report-style endpoints (`/organizations/{id}/sales`, `/expenses`, `/purchases`, `/stock`, etc.) require report permission; STAFF gets `403`.

---

## 7. Org funding (new)

`POST /api/cashflow/funding`

```json
{
  "shopId": "shop-uuid",
  "amount": 500000,
  "note": "Owner top-up"
}
```

| Who | Allowed? |
|-----|----------|
| OWNER | Yes |
| MANAGER `ALL_SHOPS` | Yes |
| MANAGER `ONE_SHOP` | No (`403`) |
| STAFF | No (`403`) |

`shopId` is required (cashflow rows are shop-linked). Prefer the org’s main shop or any shop the OWNER/ALL_SHOPS manager can access.

Success: `201` `{ "data": { ...cashFlowEntry } }`

---

## 8. Sales stock targeting (`inventoryId`) — related backend change

Sales line items support exact inventory row depletion.

### Preferred payload

```json
{
  "shopId": "shop-uuid",
  "paymentMethod": "CASH",
  "items": [
    {
      "inventoryId": "inventory-row-uuid",
      "variantId": "variant-uuid",
      "quantity": 5,
      "price": 6701
    }
  ]
}
```

### Legacy (still accepted)

```json
{
  "variantId": "variant-uuid",
  "quantity": 5,
  "price": 6701,
  "batch": "DEFAULT"
}
```

(`batchNumber` also works.)

### Mobile recommendation

1. Load stock from inventory APIs (`GET /api/inventory/shops/{shopId}`), not from product catalog alone.  
2. When selling, send the selected row’s `inventoryId` **and** `variantId`.  
3. Catalog/products list does **not** include quantity — treating missing quantity as `0` is incorrect.

---

## 9. Firebase exchange notes

- Org invites create the Firebase Auth user + Firestore profile up front (section 4.1), so invitees already have `role: "agrovet"` and onboarding flags set.
- Existing Agrovet users with `STAFF` or `MANAGER` keep that role on exchange (not overwritten to `OWNER`).
- New Firebase users without a prior Agrovet STAFF/MANAGER account still map `agrovet → OWNER` unless created via org user APIs first.
- After OWNER creates a STAFF/MANAGER, that user should Firebase-sign-in then exchange/login and receive the scoped payload in section 2.

---

## 10. Mobile checklist

- [ ] Parse `role`, `managerAccess`, `allShops`, `shopScope`, `shops` from auth/exchange  
- [ ] Lock shop UI for STAFF and MANAGER `ONE_SHOP`  
- [ ] Hide user management except for OWNER  
- [ ] Hide funding except OWNER and MANAGER `ALL_SHOPS`  
- [ ] Hide stock-add / purchase / reports for STAFF  
- [ ] Build OWNER user-management screens against org user APIs (include required `phoneNumber`)  
- [ ] After invite, sign in with the same email/password via Firebase (onboarding already complete)  

- [ ] Handle `403` as “out of scope / not allowed” (not generic network error)  
- [ ] Prefer `inventoryId` on sale line items  
- [ ] Show stock from inventory endpoints, not product catalog quantity  
- [ ] Use `POST /api/organizations/{orgId}/reports/generate` for Business Report (see `docs/mobile/business-report-api.md`)  

---

## 11. Quick reference — new / changed endpoints

| Method | Path | Who |
|--------|------|-----|
| `POST` | `/api/organizations/{orgId}/users` | OWNER, ADMIN, SUPER_ADMIN |
| `GET` | `/api/organizations/{orgId}/users` | OWNER, ADMIN, SUPER_ADMIN |
| `PATCH` | `/api/organizations/{orgId}/users/{userId}` | OWNER, ADMIN, SUPER_ADMIN |
| `POST` | `/api/organizations/{orgId}/users/{userId}/deactivate` | OWNER, ADMIN, SUPER_ADMIN |
| `POST` | `/api/organizations/{orgId}/reports/generate` | OWNER, MANAGER (scoped), ADMIN, SUPER_ADMIN |
| `GET` | `/api/organizations/{orgId}/reports` | same |
| `GET` | `/api/organizations/{orgId}/reports/{reportId}` | same |
| `POST` | `/api/cashflow/funding` | OWNER, MANAGER `ALL_SHOPS` |

Auth response fields added: `managerAccess`, `allShops`, `shopScope`, `shops`.

---

## 12. Backend deployment note

Mobile features depending on these APIs need the backend deployed from `feat/user-shop-roles` (or merged main) **and** migration applied:

- `prisma/migrations/20260713120000_add_manager_role_and_access`

Until migrate runs, `MANAGER` / `managerAccess` will fail at the database layer.
