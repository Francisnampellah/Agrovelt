# Final branch review fixes

## Fix notes

- Replaced organization-user response rows with an explicit Prisma selection that excludes `passwordHash` while retaining role, manager access, active status, and assigned shop data. Create, update, list, and deactivate responses now all use this response shape.
- Restricted STAFF and ONE_SHOP MANAGER scope resolution to one deterministically selected assignment (lowest shop ID) if legacy data contains more than one `ShopStaff` row.
- Applied report authorization to organization sales, expenses, purchases, stock, stock summary, and stock-transaction endpoints. STAFF is denied; ONE_SHOP managers must provide an in-scope `shopId`; all-shop roles retain organization-wide reports. Report service queries now apply the chosen shop scope in the database.
- Added regression coverage for password-hash omission, multi-assignment staff scope collapse, and STAFF report denial.

## Test output

```text
> agrovet@1.0.0 test
> node --require ts-node/register --test "src/**/*.test.ts"

✔ loadAuthActor reads the active user authorization state from the database (4.989ms)
✔ loadAuthActor rejects inactive and missing users (2.1266ms)
✔ registerValidation rejects STAFF role (38.4344ms)
✔ registerValidation rejects MANAGER role (10.8797ms)
✔ registerValidation accepts OWNER role (5.5203ms)
✔ preserves STAFF and MANAGER local roles during Firebase exchange (4.6709ms)
✔ only OWNER (and platform admins) can manage users (5.9836ms)
✔ org funding allowed for OWNER and ALL_SHOPS manager only (10.2539ms)
✔ staff shop ops require shopInScope (20.208ms)
✔ manager can stock/purchase/report in scope (17.7118ms)
✔ requireShopAccess lets an owner access another shop in their organization (13.5191ms)
✔ ShopController.getAll limits staff to assigned shops (14.0254ms)
✔ OrganizationController.getShops limits one-shop managers to assigned shops (11.8479ms)
✔ STAFF scope is exactly assigned shop (6.3821ms)
✔ STAFF scope collapses multiple assignments to the first shop ID (59.0742ms)
✔ ONE_SHOP manager scope is exactly assigned shop (3.3431ms)
✔ ALL_SHOPS manager scope contains every organization shop (1.1389ms)
✔ OWNER scope contains every organization shop (0.8052ms)
✔ assertShopInScope rejects shops outside the assigned scope (2.1457ms)
✔ assertShopInScope rejects all-shop actors outside their organization (4.0097ms)
✔ recordFunding creates an IN adjustment with the default organization-funding note (6.3362ms)
✔ organization funding denies ONE_SHOP managers but allows ALL_SHOPS managers and owners (0.8015ms)
✔ deductSaleStock depletes the exact inventory row when inventoryId is provided (8.6291ms)
✔ deductSaleStock rejects inventory rows from another shop (8.5863ms)
✔ deductSaleStock rejects inventory rows with variant mismatch (0.8033ms)
✔ deductSaleStock rejects insufficient stock on an exact inventory row (1.6997ms)
✔ deductSaleStock still supports legacy variant plus batch resolution (1.4371ms)
✔ deductSaleStock accepts inventoryId together with variantId and ignores batch for row selection (5.7715ms)
✔ deductSaleStock rejects inventoryId payloads only when an explicit batch mismatches the row (9.8291ms)
✔ concurrent deductions against the same inventoryId only allow available stock once (2.8229ms)
✔ createOrgUser rejects STAFF without shopId (7.4629ms)
✔ createOrgUser creates STAFF with one ShopStaff assignment and no manager access (182.3377ms)
✔ createOrgUser rejects ALL_SHOPS manager with shopId (2.1539ms)
✔ createOrgUser rejects ONE_SHOP manager without shopId (0.8646ms)
✔ createOrgUser creates ALL_SHOPS manager without ShopStaff assignments (140.689ms)
✔ createOrgUser rejects actors without user-management permission (8.9291ms)
✔ createOrgUser rejects shops outside the organization (2.6585ms)
✔ updateOrgUser removes ShopStaff rows when switching to ALL_SHOPS (1.8349ms)
✔ listOrgUsers includes each user shop assignment and manager access (1.9166ms)
✔ listOrgUsers rejects actors without user-management permission (1.5807ms)
✔ deactivateOrgUser marks the organization user inactive (5.6136ms)
✔ STAFF receives 403 for organization sales reports (13.8078ms)
✔ createForSale keeps receipt numbers unique under concurrent requests (17.8398ms)
✔ createForSale retries automatically when a generated receipt number collides (1.3678ms)
✔ sale creation returns 403 when the shop is outside the actor scope (8.8699ms)
ℹ tests 45
ℹ suites 0
ℹ pass 45
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 33897.6473
```

## Shop-scoped operational read authorization

- Enforced actor loading, shop scope checks, and operation permissions on sale list/detail, expense list, purchase list, and inventory/transaction-by-shop reads.
- Kept `Access denied` and `Insufficient permissions` responses mapped to HTTP 403 through each controller's error-status helper.
- Added regression coverage proving a STAFF user cannot list sales for an unassigned shop.

## Test output

```text
> npm test
✔ tests 46
ℹ pass 46
ℹ fail 0
```
