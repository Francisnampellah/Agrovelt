# Task 7 Report: Enforce permissions on operational APIs

**Status:** Complete  
**Commit:** `49c9174 feat(auth): enforce role and shop scope on operational APIs`

## Summary

- Added `loadAuthActor` to load current role, organization, manager access, and active status from the database.
- Sales, expenses, inventory updates/adjustments/bulk imports, purchases, receipt access, and cashflow endpoints now require their specified permission helper and shop scope.
- Permission and shop-scope denials return HTTP 403. Receipt mutations authorize the receipt shop before changing it.

## Verification

- `npm test` passed: 38 tests, 0 failures.
- `npm run build` passed.
- Added focused tests for `loadAuthActor` and a sale creation request outside the actor scope returning 403.

## Concern

- Organization-wide receipt listing without a `shopId` is restricted to actors with all-shop scope; scoped actors must supply an in-scope shop ID.
