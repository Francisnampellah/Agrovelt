# Agrovelt Inventory & Batch Management System

This document explains the production-grade Inventory Flow designed for the Agrovelt platform. It leverages a **Deterministic FEFO (First Expiry First Out)** allocation logic with strict **Relational Batch Tracking** via `inventoryId`.

## 1. Core Architecture Principles

### Relational Batch Integrity
Unlike traditional systems that track batches by string names, Agrovelt uses a strict relational model. 
- Every stock entry is a unique record in the `Inventory` table.
- Every transaction (Sale, Purchase, Transfer) is linked to a specific `inventoryId`.
- String-based `batchNumber` is retained only for human-readable labeling and legacy lookups.

### Deterministic FEFO Logic
Stock is never deducted "randomly." The system automatically selects stock from recorded batches based on the earliest expiry date to minimize waste and ensure product freshness.

---

## 2. The Purchase Flow (Stock Inbound)

When a Purchase is recorded, the system provides high flexibility for batch management:

1.  **Batch Association Options**:
    - **Top-up Existing**: User selects an `inventoryId`. The system increments stock for that specific existing batch.
    - **New Batch (Manual)**: User provides a custom `batchNumber`.
    - **Auto-Generate**: If both `inventoryId` and `batchNumber` are omitted, the system generates a unique identifier: `BATCH-<TIMESTAMP>-<RANDOM_HASH>`.
2.  **Inventory Upsert**: 
    - The system resolves the final batch identity.
    - If top-up is selected, it verifies the existence of the specific `inventoryId`.
    - It increments quantity and updates the `costPrice`.
3.  **Traceability Link**: The `PurchaseItem` is explicitly linked to the resulting `inventoryId`.
4.  **Audit Trail**: An `InventoryTransaction` of type `PURCHASE` is created, referencing the specific `inventoryId`.

---

## 3. The Sales Flow (Stock Outbound)

The sales flow is fully automated to handle multi-batch consumption:

1.  **Request**: A user submits a sale with a `variantId` and `quantity`. No batch selection is required from the user.
2.  **FEFO Allocation**:
    - The `InventoryService` queries all available `Inventory` rows for that variant in the specific shop.
    - Results are ordered by `expiryDate ASC` (Nulls last / Furthest first).
3.  **Multi-Batch Deduction**:
    - If a sale requires 50 units but the oldest batch only has 30, the system deducts 30 from the first batch and 20 from the next.
    - It returns a set of **Allocations** (Mapping `inventoryId` -> `quantity`).
4.  **Sale Item Recording**:
    - A `SaleItem` is created to represent the line item.
    - Multiple `SaleBatchAllocation` records are created for that item, tracking exactly which inventory records were used.
5.  **Audit Trail**: Unique `InventoryTransaction` records of type `SALE` are created for every batch touched.

---

## 4. The Refund & Return Flow (Restocking)

Agrovelt ensures that returns are as accurate as sales:

1.  **Traceability Lookup**: The system looks up the `SaleBatchAllocation` records for the refunded sale.
2.  **Restorative Restocking**: 
    - Stock is added back *specifically* to the `inventoryId` it was taken from.
    - This prevents "batch drift" where items from an old batch are returned but recorded against a newer, different batch.
3.  **Audit Trail**: An `InventoryTransaction` of type `RETURN` is created for each restored batch.

---

## 5. Inventory Adjustments & Transfers

### Adjustments
- Manual adjustments (damages, stock counts) require either a `batchNumber` or `inventoryId`.
- Positive adjustments create/update inventory records.
- Negative adjustments verify stock availability before deduction.

### Transfers (Branch to Branch)
- Transfers move specific `Inventory` records between shops.
- The `InventoryTransferItem` maintains a strict link to the source `inventoryId` to ensure the receiving shop inherits the correct expiry dates and cost prices.

---

## 6. Key Data Models

| Model | Purpose |
| :--- | :--- |
| **Inventory** | The source of truth for current stock levels per batch. |
| **InventoryTransaction** | The immutable ledger of all stock movements. |
| **SaleBatchAllocation** | Links sales to the specific inventory records consumed. |
| **PurchaseItem** | Links purchases to the inventory records created. |

---

## 7. Developer Cheat Sheet

- **Deducting Stock**: Always use `inventoryService.deductSaleStockFEFO()`.
- **Adding Stock**: Always use `inventoryService.receivePurchaseBatch()`.
- **Querying Levels**: Look at the `Inventory` table, grouped by `variantId` if you want total stock, or raw if you want batch breakdown.
