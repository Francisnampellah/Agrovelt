# Business Report API — Frontend contract

Authoritative customizable reports for Agrovet POS. Prefer this over stitching `/sales`, `/expenses`, `/purchases`, `/stock`.

Base path: `/api/organizations/{organizationId}`

---

## Auth

| Header | Value |
|--------|--------|
| `Authorization` | `Bearer <collector_jwt>` |

| Role | Allowed? | Shop scope when `shopIds` omitted |
|------|----------|-----------------------------------|
| `OWNER` | Yes | All org shops |
| `MANAGER` + `ALL_SHOPS` | Yes | All org shops |
| `MANAGER` + `ONE_SHOP` | Yes | Assigned shop(s) only |
| `ADMIN` / `SUPER_ADMIN` | Yes | All shops in `{organizationId}` |
| `STAFF` | **No → 403** | — |

If `shopIds` is provided, every id must be inside the caller’s allowed scope (else `403 REPORT_SHOP_OUT_OF_SCOPE`).

---

## Endpoints

| Method | Path | Success | Body |
|--------|------|---------|------|
| `POST` | `/reports/generate` | `201` | Request body (below) → full report in `{ data }` |
| `GET` | `/reports?limit=20` | `200` | — → list metadata in `{ data }` |
| `GET` | `/reports/{reportId}` | `200` | — → stored report payload in `{ data }` |

`limit` (list only): optional int `1…100`, default `20`.

---

## Generate request body

`Content-Type: application/json`

### Full schema (every field)

```json
{
  "from": "2026-07-01T00:00:00.000Z",
  "to": "2026-07-17T23:59:59.999Z",
  "shopIds": ["11111111-1111-1111-1111-111111111111"],
  "timezone": "Africa/Dar_es_Salaam",
  "groupBy": "DAY",
  "currency": "TZS",
  "include": {
    "summary": true,
    "cashMovement": true,
    "sales": false,
    "refunds": false,
    "expenses": false,
    "purchases": false,
    "funding": false,
    "inventorySnapshot": false,
    "productMovements": false,
    "topProducts": true,
    "receipts": false,
    "breakdownByShop": false,
    "breakdownByCategory": false,
    "breakdownByPaymentMethod": false,
    "timeline": true
  },
  "filters": {
    "transactionTypes": ["SALE", "REFUND", "EXPENSE", "PURCHASE", "FUNDING", "ADJUSTMENT", "RETURN", "TRANSFER", "LOSS", "EXPIRED"],
    "paymentMethods": ["CASH", "CARD", "MOBILE"],
    "productIds": [],
    "variantIds": [],
    "categoryIds": [],
    "expenseCategories": [],
    "minAmount": null,
    "maxAmount": null,
    "onlyLowStock": false,
    "lowStockThreshold": 10
  },
  "limits": {
    "topProducts": 10,
    "recentMovements": 50,
    "timelinePoints": 31
  },
  "sort": {
    "movements": "DESC",
    "topProductsBy": "REVENUE"
  }
}
```

### Top-level fields

| Field | Type | Required | Default | Rules |
|-------|------|----------|---------|--------|
| `from` | string (ISO-8601) | **Yes** | — | Must parse as date; `from <= to` |
| `to` | string (ISO-8601) | **Yes** | — | Must parse as date; range ≤ **366** days |
| `shopIds` | `string[]` (UUID) | No | caller’s shop scope | Empty / omitted → all allowed shops; each id must be in scope |
| `timezone` | string | No | `"Africa/Dar_es_Salaam"` | Echoed in `meta`; day buckets currently use UTC calendar days |
| `groupBy` | enum | No | `"DAY"` | `DAY` \| `WEEK` \| `MONTH` \| `SHOP` \| `NONE` |
| `currency` | string | No | `"TZS"` | Echoed in `meta`; amounts are decimal TZS floats |
| `include` | object | No | see defaults below | Section toggles |
| `filters` | object | No | see below | Narrow data |
| `limits` | object | No | see below | Cap list sizes |
| `sort` | object | No | see below | Ordering |

**Range rule:** `(to - from) > 366 days` → `422` `REPORT_RANGE_TOO_LARGE`.

### `include` — section toggles

If a key is omitted, the **default** applies.  
If `include.X === false`, that section is **omitted from the response** (not returned as `null` / `[]` stub).

| Key | Default | When `true`, response includes |
|-----|---------|--------------------------------|
| `summary` | `true` | `summary` totals |
| `cashMovement` | `true` | `cashMovement.in` / `.out` |
| `timeline` | `true` | `timeline` (skipped if `groupBy` is `NONE` or `SHOP`) |
| `topProducts` | `true` | `topProducts` |
| `sales` | `false` | `transactions.sales` |
| `refunds` | `false` | `transactions.refunds` |
| `expenses` | `false` | `transactions.expenses` |
| `purchases` | `false` | `transactions.purchases` |
| `funding` | `false` | `transactions.funding` |
| `inventorySnapshot` | `false` | `inventorySnapshot` |
| `productMovements` | `false` | `productMovements` |
| `receipts` | `false` | `receipts` |
| `breakdownByShop` | `false` | `breakdowns.byShop` |
| `breakdownByCategory` | `false` | `breakdowns.byCategory` |
| `breakdownByPaymentMethod` | `false` | `breakdowns.byPaymentMethod` |

### `filters`

| Field | Type | Default | Notes |
|-------|------|---------|--------|
| `transactionTypes` | string[] | all (no filter) | Allowed: `SALE`, `REFUND`, `EXPENSE`, `PURCHASE`, `FUNDING`, `ADJUSTMENT`, `RETURN`, `TRANSFER`, `LOSS`, `EXPIRED`. Used mainly for **product movements** (stock types: `SALE`, `PURCHASE`, `ADJUSTMENT`, `RETURN`, `TRANSFER`). `LOSS` / `EXPIRED` accepted but not stored yet. |
| `paymentMethods` | string[] | all | **Only** `CASH` \| `CARD` \| `MOBILE`. Used by payment-method breakdown. `MPESA` / `AIRTEL` / etc. → `400`. |
| `productIds` | UUID[] | — | Narrows top products |
| `variantIds` | UUID[] | — | Narrows top products / movements |
| `categoryIds` | UUID[] | — | Reserved (not applied in v1 aggregations yet) |
| `expenseCategories` | string[] | — | Filters expense aggregate / expense list when set |
| `minAmount` | number \| null | null | Reserved (not applied in v1 yet) |
| `maxAmount` | number \| null | null | Reserved (not applied in v1 yet) |
| `onlyLowStock` | boolean | `false` | If true, inventory snapshot items keep only `0 < qty ≤ lowStockThreshold` |
| `lowStockThreshold` | number | `10` | Used for `summary.lowStockCount` and `onlyLowStock` |

### `limits`

| Field | Type | Default | Min | Max |
|-------|------|---------|-----|-----|
| `topProducts` | int | `10` | 1 | **50** |
| `recentMovements` | int | `50` | 1 | **200** |
| `timelinePoints` | int | `31` | 1 | **366** |

Out of range → `400` `REPORT_LIMIT_INVALID`.

### `sort`

| Field | Type | Default | Values |
|-------|------|---------|--------|
| `movements` | string | `"DESC"` | `ASC` \| `DESC` (product movements by time) |
| `topProductsBy` | string | `"REVENUE"` | `REVENUE` \| `UNITS` |

### Amounts convention

All money fields are **decimal TZS** (`number` / Float), e.g. `500000` = TZS 500,000.  
**Not** integer cents.

---

## Generate response (`201`)

Envelope:

```json
{
  "data": { /* report payload */ }
}
```

### Always present: `meta`

```json
{
  "meta": {
    "reportId": "uuid",
    "organizationId": "uuid",
    "generatedAt": "2026-07-17T08:00:00.000Z",
    "from": "2026-07-01T00:00:00.000Z",
    "to": "2026-07-17T23:59:59.999Z",
    "timezone": "Africa/Dar_es_Salaam",
    "shopIds": ["uuid"],
    "shopNames": [{ "shopId": "uuid", "name": "Main Branch" }],
    "generatedBy": { "userId": "uuid", "role": "OWNER" },
    "currency": "TZS",
    "filtersApplied": { /* echoed normalized filters */ },
    "knownLimitations": {
      "inventorySnapshot": "CURRENT_STOCK_ONLY",
      "amounts": "DECIMAL_TZS_FLOAT"
    }
  }
}
```

### `summary` (if `include.summary`)

| Field | Type | Meaning |
|-------|------|---------|
| `revenue` | number | Sum of **COMPLETED** sales totals in range |
| `refunds` | number | Sum of cashflow **REFUND** outs in range |
| `expenses` | number | Sum of expenses (`Expense.date` in range) |
| `purchases` | number | Sum of purchase `totalAmount` in range |
| `funding` | number | Sum of cashflow **IN + ADJUSTMENT** in range |
| `cashIn` | number | `revenue + funding` |
| `cashOut` | number | `expenses + purchases + refunds` |
| `netCash` | number | `cashIn - cashOut` |
| `salesCount` | int | Completed sales count |
| `refundCount` | int | Refund cashflow entries count |
| `expenseCount` | int | Expenses count |
| `purchaseCount` | int | Purchases count |
| `stockValue` | number | Current inventory `qty * costPrice` (scoped shops) |
| `stockUnits` | int | Sum of current quantities |
| `skuCount` | int | Distinct `variantId`s in stock |
| `zeroStockCount` | int | Rows with `quantity <= 0` |
| `lowStockCount` | int | Rows with `0 < quantity <= lowStockThreshold` |

### `cashMovement` (if `include.cashMovement`)

```json
{
  "cashMovement": {
    "in": [{ "type": "SALE", "amount": 0, "count": 0 }],
    "out": [{ "type": "EXPENSE", "amount": 0, "count": 0 }]
  }
}
```

`in` types: `SALE`, `FUNDING` (zero rows filtered out).  
`out` types: `EXPENSE`, `PURCHASE`, `REFUND`.

### `breakdowns` (only keys that were requested)

```json
{
  "breakdowns": {
    "byPaymentMethod": [{ "method": "CASH", "amount": 0, "count": 0 }],
    "byShop": [{ "shopId": "uuid", "shopName": "Main", "revenue": 0, "salesCount": 0 }],
    "byCategory": [{ "category": "RENT", "amount": 0, "count": 0 }]
  }
}
```

- `byPaymentMethod` ← completed sale payments  
- `byShop` ← completed sales revenue per shop  
- `byCategory` ← expenses grouped by `category` (`null` → `"UNCATEGORIZED"`)

### `timeline` (if `include.timeline` and `groupBy` is `DAY`|`WEEK`|`MONTH`)

```json
{
  "timeline": [
    {
      "periodStart": "2026-07-01T00:00:00.000Z",
      "periodEnd": "2026-07-01T23:59:59.999Z",
      "revenue": 0,
      "expenses": 0,
      "purchases": 0,
      "refunds": 0,
      "net": 0
    }
  ]
}
```

`net` = `revenue - expenses - purchases - refunds`.  
Array capped to last `limits.timelinePoints` periods (sorted ascending).

### `topProducts` (if `include.topProducts`)

```json
{
  "topProducts": [
    {
      "productId": "uuid",
      "variantId": "uuid",
      "name": "Product name",
      "sku": "SKU-1",
      "unitsSold": 0,
      "revenue": 0,
      "stock": 0,
      "stockValue": 0
    }
  ]
}
```

Sorted by `sort.topProductsBy`; length ≤ `limits.topProducts`.  
`stock` / `stockValue` are **current** inventory for that variant across scoped shops.

### `inventorySnapshot` (if `include.inventorySnapshot`)

```json
{
  "inventorySnapshot": {
    "asOf": "2026-07-17T08:00:00.000Z",
    "semantics": "CURRENT_STOCK",
    "items": [
      {
        "shopId": "uuid",
        "variantId": "uuid",
        "productId": "uuid",
        "productName": "Feed",
        "sku": "SKU-1",
        "quantity": 5,
        "costPrice": 10,
        "stockValue": 50
      }
    ]
  }
}
```

**Not** historical as-of `to` — live stock at generate time.

### `productMovements` (if `include.productMovements`)

```json
{
  "productMovements": [
    {
      "id": "uuid",
      "at": "2026-07-02T10:00:00.000Z",
      "type": "SALE",
      "shopId": "uuid",
      "shopName": "Main",
      "productName": "Feed",
      "variantId": "uuid",
      "quantity": -2,
      "amount": 0,
      "referenceId": "uuid-or-null",
      "referenceType": "SALE"
    }
  ]
}
```

From `InventoryTransaction`. `amount` is `0` in v1 (qty-only).  
Length ≤ `limits.recentMovements`.

### `transactions` (only requested lists)

Each list capped at **200** rows, newest first.

```json
{
  "transactions": {
    "sales": [
      {
        "id": "uuid",
        "shopId": "uuid",
        "total": 0,
        "status": "COMPLETED",
        "createdAt": "2026-07-02T10:00:00.000Z",
        "payments": [{ "method": "CASH", "amount": 0 }]
      }
    ],
    "refunds": [
      {
        "id": "uuid",
        "shopId": "uuid",
        "amount": 0,
        "referenceId": "sale-uuid",
        "createdAt": "2026-07-03T10:00:00.000Z",
        "note": null
      }
    ],
    "expenses": [
      {
        "id": "uuid",
        "shopId": "uuid",
        "title": "Rent",
        "amount": 0,
        "category": "RENT",
        "date": "2026-07-01T00:00:00.000Z"
      }
    ],
    "purchases": [
      {
        "id": "uuid",
        "shopId": "uuid",
        "totalAmount": 0,
        "createdAt": "2026-07-01T00:00:00.000Z",
        "supplierId": null
      }
    ],
    "funding": [
      {
        "id": "uuid",
        "shopId": "uuid",
        "amount": 0,
        "note": "Organization funding",
        "createdAt": "2026-07-01T00:00:00.000Z"
      }
    ]
  }
}
```

### `receipts` (if `include.receipts`)

```json
{
  "receipts": [
    {
      "id": "uuid",
      "receiptNumber": "RCP-...",
      "saleId": "uuid",
      "shopId": "uuid",
      "status": "ISSUED",
      "createdAt": "2026-07-02T10:00:00.000Z"
    }
  ]
}
```

---

## List response (`200`)

```json
{
  "data": [
    {
      "reportId": "uuid",
      "organizationId": "uuid",
      "from": "2026-07-01T00:00:00.000Z",
      "to": "2026-07-17T23:59:59.999Z",
      "timezone": "Africa/Dar_es_Salaam",
      "currency": "TZS",
      "shopIds": ["uuid"],
      "generatedAt": "2026-07-17T08:00:00.000Z",
      "generatedBy": {
        "userId": "uuid",
        "name": "Owner Name",
        "role": "OWNER"
      }
    }
  ]
}
```

Use `reportId` with **Get by id** to load the full frozen payload.

---

## Get by id response (`200`)

Same shape as generate’s `data` (the stored snapshot). Numbers do not update if sales happen later.

---

## Errors

Stable body:

```json
{
  "error": "Human readable message",
  "code": "REPORT_RANGE_TOO_LARGE",
  "details": {}
}
```

| HTTP | Code | When |
|------|------|------|
| `400` | `REPORT_VALIDATION_FAILED` | express-validator (bad ISO date, bad UUID in `shopIds`, etc.) |
| `400` | `REPORT_DATES_REQUIRED` | missing `from` / `to` |
| `400` | `REPORT_DATES_INVALID` | unparseable dates |
| `400` | `REPORT_DATE_ORDER` | `from > to` |
| `400` | `REPORT_GROUP_BY_INVALID` | bad `groupBy` |
| `400` | `REPORT_PAYMENT_METHOD_INVALID` | e.g. `MPESA` |
| `400` | `REPORT_TRANSACTION_TYPE_INVALID` | unknown type |
| `400` | `REPORT_LIMIT_INVALID` | limit out of range |
| `401` | — | missing/invalid JWT |
| `403` | `REPORT_FORBIDDEN` | STAFF / no permission |
| `403` | `REPORT_SHOP_OUT_OF_SCOPE` | `details.shopIds` lists offenders |
| `404` | `ORG_NOT_FOUND` / `REPORT_NOT_FOUND` | org or report missing |
| `422` | `REPORT_RANGE_TOO_LARGE` | `details.maxDays`, `details.rangeDays` |
| `422` | `REPORT_NO_SHOPS` | caller has no shops in scope |

---

## Frontend examples

### 1) Cash-focused, last 7 days, all allowed shops

```http
POST /api/organizations/{organizationId}/reports/generate
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "from": "2026-07-10T00:00:00.000Z",
  "to": "2026-07-17T23:59:59.999Z",
  "timezone": "Africa/Dar_es_Salaam",
  "groupBy": "DAY",
  "currency": "TZS",
  "include": {
    "summary": true,
    "cashMovement": true,
    "timeline": true,
    "topProducts": false,
    "inventorySnapshot": false,
    "productMovements": false,
    "sales": false,
    "refunds": false,
    "expenses": false,
    "purchases": false,
    "funding": false,
    "receipts": false,
    "breakdownByShop": false,
    "breakdownByCategory": false,
    "breakdownByPaymentMethod": true
  },
  "limits": {
    "timelinePoints": 7
  }
}
```

### 2) Inventory + movements, one shop, last 30 days

```json
{
  "from": "2026-06-17T00:00:00.000Z",
  "to": "2026-07-17T23:59:59.999Z",
  "shopIds": ["11111111-1111-1111-1111-111111111111"],
  "timezone": "Africa/Dar_es_Salaam",
  "groupBy": "DAY",
  "include": {
    "summary": true,
    "cashMovement": false,
    "timeline": false,
    "topProducts": true,
    "inventorySnapshot": true,
    "productMovements": true,
    "sales": false,
    "refunds": false,
    "expenses": false,
    "purchases": false,
    "funding": false,
    "receipts": false,
    "breakdownByShop": false,
    "breakdownByCategory": false,
    "breakdownByPaymentMethod": false
  },
  "filters": {
    "onlyLowStock": false,
    "lowStockThreshold": 10,
    "transactionTypes": ["SALE", "PURCHASE", "ADJUSTMENT", "RETURN", "TRANSFER"]
  },
  "limits": {
    "topProducts": 10,
    "recentMovements": 50
  },
  "sort": {
    "movements": "DESC",
    "topProductsBy": "REVENUE"
  }
}
```

### 3) Full report

```json
{
  "from": "2026-07-01T00:00:00.000Z",
  "to": "2026-07-17T23:59:59.999Z",
  "timezone": "Africa/Dar_es_Salaam",
  "groupBy": "DAY",
  "currency": "TZS",
  "include": {
    "summary": true,
    "cashMovement": true,
    "sales": true,
    "refunds": true,
    "expenses": true,
    "purchases": true,
    "funding": true,
    "inventorySnapshot": true,
    "productMovements": true,
    "topProducts": true,
    "receipts": false,
    "breakdownByShop": true,
    "breakdownByCategory": true,
    "breakdownByPaymentMethod": true,
    "timeline": true
  },
  "filters": {
    "paymentMethods": ["CASH", "CARD", "MOBILE"],
    "onlyLowStock": false,
    "lowStockThreshold": 10
  },
  "limits": {
    "topProducts": 10,
    "recentMovements": 50,
    "timelinePoints": 31
  },
  "sort": {
    "movements": "DESC",
    "topProductsBy": "REVENUE"
  }
}
```

### Suggested Flutter / Dart model sketch

```dart
class GenerateBusinessReportRequest {
  final DateTime from;
  final DateTime to;
  final List<String>? shopIds;
  final String timezone; // default Africa/Dar_es_Salaam
  final String groupBy; // DAY|WEEK|MONTH|SHOP|NONE
  final String currency; // TZS
  final ReportInclude include;
  final ReportFilters? filters;
  final ReportLimits? limits;
  final ReportSort? sort;
}
```

Parse response as `response['data']`. Check section presence with `containsKey` — do not assume empty lists when `include.X` was false.

---

## Known limitations (v1)

- Inventory snapshot is **current stock only** (`semantics: CURRENT_STOCK`).
- Payment methods are `CASH|CARD|MOBILE` only (no MPESA/AIRTEL/TIGO/BANK split).
- `categoryIds`, `minAmount`, `maxAmount` are accepted but not applied yet.
- `LOSS` / `EXPIRED` transaction types are not in DB yet.
- Product movement `amount` is always `0`.
- No PDF/CSV export endpoint yet — client can render PDF from JSON.
- Timeline buckets use UTC calendar boundaries (timezone is stored/echoed for display).

## Migration

Apply `prisma/migrations/20260717120000_add_business_reports` before calling these endpoints.
