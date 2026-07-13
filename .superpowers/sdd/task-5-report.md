# Task 5 Report: Preserve local staff and manager roles

**Status:** Complete with a pre-existing build dependency issue  
**Branch:** `feat/user-shop-roles`

## Summary

- Added `shouldPreserveLocalRole`, which keeps locally assigned `STAFF` and `MANAGER` roles during Firebase token exchange.
- Firebase exchange now updates only an unlinked Firebase UID or a role that is not locally protected.
- Exchange and profile payloads now add `managerAccess`, `allShops`, and named `shops`, while retaining `shopScope` as the existing string ID array.
- Both response paths use `resolveShopScope`, including organization-wide scope for owners and all-shop managers.

## Verification

- New role-preservation unit test passed.
- `npm test` passed: 32 tests, 0 failures.
- `npm run build` reports only the existing `src/index.ts` missing-module error for `cors`; no Task 5 type errors remain.

## Concern

TypeScript cannot resolve the existing `cors` import or declarations in `src/index.ts`. This task did not modify that dependency or file.
