# Inventory System Refactoring Guide

> **Scope:** Pricing architecture, inventory service, and cash flow module separation.
> **Stack:** Node.js · TypeScript · Prisma · PostgreSQL

---

## Table of Contents

1. [Overview](#1-overview)
2. [Schema Changes](#2-schema-changes)
3. [Pricing Module Refactor](#3-pricing-module-refactor)
4. [Inventory Service Refactor](#4-inventory-service-refactor)
5. [Purchase Flow Refactor](#5-purchase-flow-refactor)
6. [Sale Flow Refactor](#6-sale-flow-refactor)
7. [Cash Flow Module (New)](#7-cash-flow-module-new)
8. [Migration Plan](#8-migration-plan)
9. [File & Folder Structure](#9-file--folder-structure)

---

## 1. Overview

### Problems Being Solved

| Problem | Impact |
|---|---|
| `Inventory.sellingPrice` overwritten on every upsert | Price history lost silently |
| No default price on `ProductVariant` | Prices default to `0` if not manually set |
| `costPrice` and `sellingPrice` have no enforced relationship | Margins untraceable |
| No minimum price floor | Staff can sell below cost |
| Cash flow mixed into sales/expenses with no unified view | Cannot produce P&L or cash position |
| Race condition in `adjustInventory` | Stock can go negative under concurrent load |

### Guiding Principles

- **Prices have a clear ownership chain:** variant default → shop override → batch cost. Each layer has one job.
- **Nothing is ever overwritten silently.** All price changes are appended to a history log.
- **Cash flow is a first-class module.** It is not derived from scattered `Sale`, `Purchase`, and `Expense` records at query time — it is recorded explicitly as money moves.
- **Inventory tracks stock and batch cost only.** Selling price moves out of `Inventory`.

---

## 2. Schema Changes

### 2.1 Add to `ProductVariant`

```prisma
model ProductVariant {
  // --- existing fields unchanged ---

  defaultCostPrice    Float?   // Org-wide fallback cost
  defaultSellingPrice Float?   // Org-wide fallback selling price
  markupPercent       Float?   // If set, selling price = costPrice * (1 + markup/100)
}
```

### 2.2 New Model — `ShopVariantPrice`

Replaces `Inventory.sellingPrice`. Owns the selling price per shop per variant.

```prisma
model ShopVariantPrice {
  id              String   @id @default(uuid())
  shopId          String
  variantId       String
  sellingPrice    Float
  minSellingPrice Float?   // Staff cannot sell below this
  updatedAt       DateTime @updatedAt
  updatedBy       String

  shop    Shop           @relation(fields: [shopId], references: [id])
  variant ProductVariant @relation(fields: [variantId], references: [id])

  @@unique([shopId, variantId])
}
```

### 2.3 New Model — `PriceHistory`

Append-only log. Never update or delete rows.

```prisma
enum PriceType {
  COST
  SELLING
  MIN_SELLING
}

model PriceHistory {
  id        String    @id @default(uuid())
  shopId    String?   // null = variant-level (org-wide) change
  variantId String
  priceType PriceType
  oldPrice  Float
  newPrice  Float
  reason    String?
  changedBy String    // User ID
  createdAt DateTime  @default(now())
}
```

### 2.4 New Model — `CashFlowEntry`

```prisma
enum CashFlowDirection {
  IN
  OUT
}

enum CashFlowCategory {
  SALE
  PURCHASE
  EXPENSE
  TRANSFER_IN
  TRANSFER_OUT
  ADJUSTMENT
  REFUND
}

model CashFlowEntry {
  id          String              @id @default(uuid())
  shopId      String
  direction   CashFlowDirection
  category    CashFlowCategory
  amount      Float
  referenceId String?             // sale ID, purchase ID, expense ID, etc.
  note        String?
  recordedBy  String              // User ID
  createdAt   DateTime            @default(now())

  shop Shop @relation(fields: [shopId], references: [id])
}
```

### 2.5 Remove from `Inventory`

```diff
model Inventory {
  id           String    @id @default(uuid())
  shopId       String
  variantId    String
  batchNumber  String    @default("DEFAULT")
  expiryDate   DateTime?
  quantity     Int       @default(0)
  costPrice    Float     // Keep — this is the batch's actual purchase cost
- sellingPrice Float     // REMOVE — moves to ShopVariantPrice
  updatedAt    DateTime  @updatedAt
}
```

---

## 3. Pricing Module Refactor

### 3.1 Create `src/modules/pricing/pricing.service.ts`

This service owns all price reads and writes. No other service should directly write to `ShopVariantPrice`, `ProductVariant` price fields, or `PriceHistory`.

#### `resolveSellingPrice(shopId, variantId): Promise<number>`

```typescript
async resolveSellingPrice(shopId: string, variantId: string): Promise<number> {
  // Priority 1: Shop-level override
  const shopPrice = await this.prisma.shopVariantPrice.findUnique({
    where: { shopId_variantId: { shopId, variantId } }
  })
  if (shopPrice) return shopPrice.sellingPrice

  // Priority 2: Variant-level default
  const variant = await this.prisma.productVariant.findUnique({
    where: { id: variantId }
  })
  if (variant?.defaultSellingPrice) return variant.defaultSellingPrice

  throw new Error(
    `No selling price configured for variant ${variantId} in shop ${shopId}. ` +
    `Set a default on the variant or a shop override.`
  )
}
```

#### `updateShopSellingPrice(params): Promise<void>`

```typescript
async updateShopSellingPrice(params: {
  shopId: string
  variantId: string
  newPrice: number
  minSellingPrice?: number
  reason?: string
  changedBy: string
}): Promise<void> {
  const existing = await this.prisma.shopVariantPrice.findUnique({
    where: { shopId_variantId: { shopId: params.shopId, variantId: params.variantId } }
  })

  await this.prisma.$transaction(async (tx) => {
    await tx.shopVariantPrice.upsert({
      where: { shopId_variantId: { shopId: params.shopId, variantId: params.variantId } },
      update: {
        sellingPrice: params.newPrice,
        ...(params.minSellingPrice !== undefined && { minSellingPrice: params.minSellingPrice }),
        updatedBy: params.changedBy
      },
      create: {
        shopId: params.shopId,
        variantId: params.variantId,
        sellingPrice: params.newPrice,
        minSellingPrice: params.minSellingPrice ?? null,
        updatedBy: params.changedBy
      }
    })

    // Always log the change
    if (existing?.sellingPrice !== params.newPrice) {
      await tx.priceHistory.create({
        data: {
          shopId: params.shopId,
          variantId: params.variantId,
          priceType: 'SELLING',
          oldPrice: existing?.sellingPrice ?? 0,
          newPrice: params.newPrice,
          reason: params.reason ?? null,
          changedBy: params.changedBy
        }
      })
    }
  })
}
```

#### `validateSalePrice(shopId, variantId, chargedPrice): Promise<void>`

```typescript
async validateSalePrice(shopId: string, variantId: string, chargedPrice: number): Promise<void> {
  const shopPrice = await this.prisma.shopVariantPrice.findUnique({
    where: { shopId_variantId: { shopId, variantId } }
  })

  if (shopPrice?.minSellingPrice !== null && chargedPrice < shopPrice!.minSellingPrice!) {
    throw new Error(
      `Charged price ${chargedPrice} is below the minimum allowed price of ${shopPrice!.minSellingPrice}`
    )
  }
}
```

#### `autoUpdateSellingPriceFromCost(tx, params): Promise<void>`

Called after a purchase lands. Only runs if `markupPercent` is configured.

```typescript
async autoUpdateSellingPriceFromCost(
  tx: Prisma.TransactionClient,
  params: { shopId: string; variantId: string; newCostPrice: number; changedBy: string }
): Promise<void> {
  const variant = await tx.productVariant.findUnique({ where: { id: params.variantId } })

  if (!variant?.markupPercent) return // Auto-pricing not configured; manual override required

  const newSellingPrice = parseFloat(
    (params.newCostPrice * (1 + variant.markupPercent / 100)).toFixed(2)
  )

  await this.updateShopSellingPrice({
    shopId: params.shopId,
    variantId: params.variantId,
    newPrice: newSellingPrice,
    reason: `Auto-calculated: cost ${params.newCostPrice} + ${variant.markupPercent}% markup`,
    changedBy: params.changedBy
  })
}
```

---

## 4. Inventory Service Refactor

### 4.1 Fix Race Condition in `adjustInventory`

Replace the upsert + post-check pattern with an atomic conditional update:

```typescript
async adjustInventory(data: AdjustInventoryRequest) {
  return this.prisma.$transaction(async (tx) => {
    // Atomic decrement — only succeeds if quantity won't go negative
    if (data.change < 0) {
      const result = await tx.inventory.updateMany({
        where: {
          shopId: data.shopId,
          variantId: data.variantId,
          batchNumber: data.batchNumber ?? 'DEFAULT',
          quantity: { gte: Math.abs(data.change) }   // Guard here, not after
        },
        data: { quantity: { increment: data.change } }
      })

      if (result.count === 0) {
        throw new Error('Insufficient stock or inventory record does not exist')
      }
    } else {
      // Positive adjustment (PURCHASE, RETURN) — upsert is safe
      await tx.inventory.upsert({
        where: {
          shopId_variantId_batchNumber: {
            shopId: data.shopId,
            variantId: data.variantId,
            batchNumber: data.batchNumber ?? 'DEFAULT'
          }
        },
        update: { quantity: { increment: data.change } },
        create: {
          shopId: data.shopId,
          variantId: data.variantId,
          batchNumber: data.batchNumber ?? 'DEFAULT',
          quantity: data.change,
          costPrice: data.costPrice ?? 0  // Must be provided for new records
        }
      })
    }

    // Record transaction log
    await tx.inventoryTransaction.create({
      data: {
        shopId: data.shopId,
        variantId: data.variantId,
        batchNumber: data.batchNumber ?? 'DEFAULT',
        type: data.type,
        quantity: data.change,
        referenceId: data.referenceId ?? null
      }
    })
  })
}
```

### 4.2 Remove `sellingPrice` from `updateInventory`

`updateInventory` should only manage stock levels and batch cost. Delegate price changes to `PricingService`:

```typescript
async updateInventory(data: UpdateInventoryRequest) {
  const { shopId, variantId, batchNumber = 'DEFAULT', expiryDate, quantity, costPrice } = data
  // sellingPrice is NO LONGER accepted here

  return this.prisma.inventory.upsert({
    where: { shopId_variantId_batchNumber: { shopId, variantId, batchNumber } },
    update: {
      quantity,
      costPrice,
      ...(expiryDate && { expiryDate: new Date(expiryDate) })
    },
    create: {
      shopId, variantId, batchNumber, quantity, costPrice,
      ...(expiryDate && { expiryDate: new Date(expiryDate) })
    }
  })
}
```

### 4.3 Add Cross-Tenant Validation

Add a shared guard used by all inventory methods:

```typescript
private async validateShopVariantOwnership(shopId: string, variantId: string): Promise<void> {
  const shop = await this.prisma.shop.findUnique({ where: { id: shopId } })
  if (!shop) throw new Error('Shop not found')

  const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } })
  if (!variant) throw new Error('Product variant not found')

  if (shop.organizationId !== variant.organizationId) {
    throw new Error('Shop and product variant do not belong to the same organization')
  }
}
```

### 4.4 Add Pagination to `getTransactionsByShop`

```typescript
async getTransactionsByShop(shopId: string, cursor?: string, take = 50) {
  return this.prisma.inventoryTransaction.findMany({
    where: { shopId },
    take,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    orderBy: { createdAt: 'desc' },
    include: { variant: { include: { product: true } } }
  })
}
```

---

## 5. Purchase Flow Refactor

### `src/modules/purchase/purchase.service.ts`

When a purchase is processed it must:

1. Create the `Purchase` and `PurchaseItem` records
2. Increment inventory stock via `InventoryService.adjustInventory`
3. Update the batch cost price on `Inventory`
4. Optionally auto-update the selling price via `PricingService.autoUpdateSellingPriceFromCost`
5. Record a `CashFlowEntry` (OUT) via `CashFlowService`

```typescript
async createPurchase(data: CreatePurchaseRequest) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Create purchase header
    const purchase = await tx.purchase.create({
      data: {
        shopId: data.shopId,
        supplierId: data.supplierId ?? null,
        totalAmount: data.items.reduce((sum, i) => sum + i.costPrice * i.quantity, 0),
        createdBy: data.createdBy
      }
    })

    for (const item of data.items) {
      // 2. Create purchase line item
      await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          variantId: item.variantId,
          batchNumber: item.batchNumber ?? 'DEFAULT',
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
          quantity: item.quantity,
          costPrice: item.costPrice
        }
      })

      // 3. Increment stock + update batch cost
      await tx.inventory.upsert({
        where: {
          shopId_variantId_batchNumber: {
            shopId: data.shopId,
            variantId: item.variantId,
            batchNumber: item.batchNumber ?? 'DEFAULT'
          }
        },
        update: { quantity: { increment: item.quantity }, costPrice: item.costPrice },
        create: {
          shopId: data.shopId,
          variantId: item.variantId,
          batchNumber: item.batchNumber ?? 'DEFAULT',
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
          quantity: item.quantity,
          costPrice: item.costPrice
        }
      })

      // 4. Auto-update selling price if markup is configured
      await this.pricingService.autoUpdateSellingPriceFromCost(tx, {
        shopId: data.shopId,
        variantId: item.variantId,
        newCostPrice: item.costPrice,
        changedBy: data.createdBy
      })

      // 5. Log inventory transaction
      await tx.inventoryTransaction.create({
        data: {
          shopId: data.shopId,
          variantId: item.variantId,
          batchNumber: item.batchNumber ?? 'DEFAULT',
          type: 'PURCHASE',
          quantity: item.quantity,
          referenceId: purchase.id
        }
      })
    }

    // 6. Record cash outflow
    await this.cashFlowService.record(tx, {
      shopId: data.shopId,
      direction: 'OUT',
      category: 'PURCHASE',
      amount: purchase.totalAmount,
      referenceId: purchase.id,
      recordedBy: data.createdBy
    })

    return purchase
  })
}
```

---

## 6. Sale Flow Refactor

### `src/modules/sale/sale.service.ts`

When a sale is processed it must:

1. Resolve and validate selling price via `PricingService`
2. Decrement inventory via `InventoryService.adjustInventory`
3. Create `Sale`, `SaleItem`, and `Payment` records
4. Record a `CashFlowEntry` (IN) via `CashFlowService`

```typescript
async createSale(data: CreateSaleRequest) {
  return this.prisma.$transaction(async (tx) => {
    for (const item of data.items) {
      // 1. Resolve and validate price
      const resolvedPrice = await this.pricingService.resolveSellingPrice(data.shopId, item.variantId)
      await this.pricingService.validateSalePrice(data.shopId, item.variantId, item.price)

      // Use resolved price if caller did not specify one
      item.price = item.price ?? resolvedPrice

      // 2. Decrement stock (atomic — see Section 4.1)
      await this.inventoryService.adjustInventory({
        shopId: data.shopId,
        variantId: item.variantId,
        batchNumber: item.batchNumber ?? 'DEFAULT',
        change: -item.quantity,
        type: 'SALE',
        referenceId: null
      })
    }

    // 3. Create sale record
    const total = data.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const sale = await tx.sale.create({
      data: {
        shopId: data.shopId,
        subtotal: total,
        discount: data.discount ?? 0,
        tax: data.tax ?? 0,
        total: total - (data.discount ?? 0) + (data.tax ?? 0),
        createdBy: data.createdBy,
        items: {
          create: data.items.map(i => ({
            variantId: i.variantId,
            batchNumber: i.batchNumber ?? null,
            quantity: i.quantity,
            price: i.price
          }))
        },
        payments: {
          create: data.payments.map(p => ({ amount: p.amount, method: p.method }))
        }
      }
    })

    // 4. Record cash inflow
    await this.cashFlowService.record(tx, {
      shopId: data.shopId,
      direction: 'IN',
      category: 'SALE',
      amount: sale.total,
      referenceId: sale.id,
      recordedBy: data.createdBy
    })

    return sale
  })
}
```

---

## 7. Cash Flow Module (New)

> **Rule:** Cash flow is its own module. Sales, purchases, and expenses never query each other's tables to compute cash position. They each write to `CashFlowEntry` as a side-effect.

### 7.1 `src/modules/cashflow/cashflow.service.ts`

```typescript
export class CashFlowService {
  constructor(private prisma: PrismaClient) {}

  // Internal — called within transactions by other services
  async record(
    tx: Prisma.TransactionClient,
    data: {
      shopId: string
      direction: 'IN' | 'OUT'
      category: CashFlowCategory
      amount: number
      referenceId?: string
      note?: string
      recordedBy: string
    }
  ) {
    await tx.cashFlowEntry.create({ data })
  }

  // Public — queried by reports and dashboards
  async getSummary(shopId: string, from: Date, to: Date) {
    const entries = await this.prisma.cashFlowEntry.findMany({
      where: { shopId, createdAt: { gte: from, lte: to } }
    })

    const totalIn  = entries.filter(e => e.direction === 'IN').reduce((s, e) => s + e.amount, 0)
    const totalOut = entries.filter(e => e.direction === 'OUT').reduce((s, e) => s + e.amount, 0)

    return {
      totalIn,
      totalOut,
      netCashFlow: totalIn - totalOut,
      byCategory: this.groupByCategory(entries)
    }
  }

  async getEntries(shopId: string, filters: {
    direction?: 'IN' | 'OUT'
    category?: CashFlowCategory
    from?: Date
    to?: Date
    cursor?: string
    take?: number
  }) {
    const { direction, category, from, to, cursor, take = 50 } = filters
    return this.prisma.cashFlowEntry.findMany({
      where: {
        shopId,
        ...(direction && { direction }),
        ...(category && { category }),
        ...(from && to && { createdAt: { gte: from, lte: to } })
      },
      take,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: 'desc' }
    })
  }

  private groupByCategory(entries: CashFlowEntry[]) {
    return entries.reduce((acc, entry) => {
      const key = entry.category
      if (!acc[key]) acc[key] = { in: 0, out: 0 }
      if (entry.direction === 'IN') acc[key].in += entry.amount
      else acc[key].out += entry.amount
      return acc
    }, {} as Record<string, { in: number; out: number }>)
  }
}
```

### 7.2 Who Writes to Cash Flow

| Event | Direction | Category | Written By |
|---|---|---|---|
| Sale completed | IN | `SALE` | `SaleService` |
| Sale refunded | OUT | `REFUND` | `SaleService` |
| Purchase received | OUT | `PURCHASE` | `PurchaseService` |
| Expense recorded | OUT | `EXPENSE` | `ExpenseService` |
| Stock transfer sent | OUT | `TRANSFER_OUT` | `TransferService` |
| Stock transfer received | IN | `TRANSFER_IN` | `TransferService` |
| Inventory adjustment | IN/OUT | `ADJUSTMENT` | `InventoryService` |

### 7.3 Expense Service Integration

Update `ExpenseService` to write cash flow on every expense:

```typescript
async createExpense(data: CreateExpenseRequest) {
  return this.prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({ data: { ...data } })

    await this.cashFlowService.record(tx, {
      shopId: data.shopId,
      direction: 'OUT',
      category: 'EXPENSE',
      amount: data.amount,
      referenceId: expense.id,
      note: data.title,
      recordedBy: data.createdBy
    })

    return expense
  })
}
```

---

## 8. Migration Plan

### Phase 1 — Schema (no breaking changes yet)

Add new tables without removing anything. Application still reads `Inventory.sellingPrice` during this phase.

```bash
npx prisma migrate dev --name "add_pricing_and_cashflow_tables"
```

### Phase 2 — Backfill existing data

```sql
-- Migrate Inventory.sellingPrice → ShopVariantPrice
INSERT INTO "ShopVariantPrice" (id, "shopId", "variantId", "sellingPrice", "updatedBy", "updatedAt")
SELECT
  gen_random_uuid(),
  i."shopId",
  i."variantId",
  i."sellingPrice",
  'system-migration',
  NOW()
FROM "Inventory" i
ON CONFLICT ("shopId", "variantId") DO NOTHING;

-- Backfill CashFlowEntry from historical sales
INSERT INTO "CashFlowEntry" (id, "shopId", direction, category, amount, "referenceId", "recordedBy", "createdAt")
SELECT gen_random_uuid(), "shopId", 'IN', 'SALE', total, id, "createdBy", "createdAt"
FROM "Sale" WHERE status = 'COMPLETED';

-- Backfill CashFlowEntry from historical purchases
INSERT INTO "CashFlowEntry" (id, "shopId", direction, category, amount, "referenceId", "recordedBy", "createdAt")
SELECT gen_random_uuid(), "shopId", 'OUT', 'PURCHASE', "totalAmount", id, "createdBy", "createdAt"
FROM "Purchase";

-- Backfill CashFlowEntry from historical expenses
INSERT INTO "CashFlowEntry" (id, "shopId", direction, category, amount, "referenceId", "recordedBy", "createdAt")
SELECT gen_random_uuid(), "shopId", 'OUT', 'EXPENSE', amount, id, 'system-migration', date
FROM "Expense";
```

### Phase 3 — Swap application reads

- Update all price reads to go through `PricingService.resolveSellingPrice`
- Update all cash position reads to go through `CashFlowService.getSummary`
- All new writes go through the refactored services from this point

### Phase 4 — Remove `Inventory.sellingPrice`

Only after all reads have been confirmed to go through `PricingService`.

```bash
npx prisma migrate dev --name "drop_inventory_selling_price"
```

---

## 9. File & Folder Structure

```
src/
├── modules/
│   ├── inventory/
│   │   ├── inventory.service.ts     ← stock levels & transactions only
│   │   ├── inventory.controller.ts
│   │   └── inventory.types.ts
│   │
│   ├── pricing/
│   │   ├── pricing.service.ts       ← all price reads & writes
│   │   ├── pricing.controller.ts    ← admin endpoints to set prices
│   │   └── pricing.types.ts
│   │
│   ├── purchase/
│   │   ├── purchase.service.ts      ← orchestrates inventory + pricing + cashflow
│   │   ├── purchase.controller.ts
│   │   └── purchase.types.ts
│   │
│   ├── sale/
│   │   ├── sale.service.ts          ← orchestrates inventory + pricing + cashflow
│   │   ├── sale.controller.ts
│   │   └── sale.types.ts
│   │
│   ├── cashflow/
│   │   ├── cashflow.service.ts      ← record() is internal, getSummary() is public
│   │   ├── cashflow.controller.ts   ← reporting endpoints only
│   │   └── cashflow.types.ts
│   │
│   └── expense/
│       ├── expense.service.ts       ← writes to cashflow on every create
│       ├── expense.controller.ts
│       └── expense.types.ts
│
└── prisma/
    └── schema.prisma
```

---

*End of Refactoring Guide*