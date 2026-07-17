# Customizable Agrovet Business Report API — Design

**Date:** 2026-07-17  
**Status:** Approved for implementation

## Decisions

| Topic | Choice |
|-------|--------|
| Shop scope when `shopIds` omitted | Resolve to caller’s `shopScope` (ONE_SHOP → assigned shop; OWNER/ALL_SHOPS → all org shops) |
| Persistence | Persist every generate; support list + get-by-id |
| Inventory snapshot | Current live stock at generate time (`asOf = generatedAt`); not historical |
| Payment methods | `CASH \| CARD \| MOBILE` only |
| Generation | Synchronous JSON for ranges ≤ 366 days |
| Amounts | Decimal `Float` TZS (existing project convention) |
| Unused sections | Omitted from response when `include.X = false` |

## Endpoints

1. `POST /api/organizations/{organizationId}/reports/generate` — compute, persist, return payload  
2. `GET /api/organizations/{organizationId}/reports` — list recent report metadata  
3. `GET /api/organizations/{organizationId}/reports/{reportId}` — fetch stored payload  

## AuthZ

- STAFF → 403  
- OWNER / MANAGER (ALL_SHOPS or ONE_SHOP within scope) / ADMIN / SUPER_ADMIN → allowed  
- Requested `shopIds` must be subset of allowed shops else 403  
- Caller must pass `assertOrganizationAccess` (SUPER_ADMIN bypass; others must belong to org)

## Semantics

- **Revenue:** `Sale.status = COMPLETED`, `createdAt` in range  
- **Refunds:** `CashFlowEntry` `category = REFUND`, `direction = OUT`, `createdAt` in range  
- **Expenses / purchases:** `Expense.date` / `Purchase.createdAt` in range  
- **Funding:** `CashFlowEntry` `IN` + `ADJUSTMENT` in range  
- **Product movements:** `InventoryTransaction` in range  
- **Inventory snapshot:** current `Inventory` rows for scoped shops  

## Persistence

`BusinessReport` table: id, organizationId, generatedByUserId, from, to, timezone, currency, shopIds (JSON), request (JSON), payload (JSON), createdAt.

## Known limitations

- Inventory snapshot is not as-of historical stock.  
- No LOSS/EXPIRED inventory txn types yet (schema has PURCHASE/SALE/ADJUSTMENT/RETURN/TRANSFER).  
- No PDF/CSV export or async jobs in v1.  
- Payment carrier split (MPESA/etc.) not available.  
