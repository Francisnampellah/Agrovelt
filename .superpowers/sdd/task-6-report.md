# Task 6 Report: Update requireShopAccess and filter shop lists

**Status:** Complete with a pre-existing build dependency issue  
**Commit:** `fe29c72 feat(auth): enforce shop scope on shop access and listings`

## Summary

- `requireShopAccess` now loads `managerAccess`, constructs an `AuthActor`, and delegates shop authorization to `assertShopInScope`.
- `ADMIN` and `SUPER_ADMIN` bypass scope validation; owner and all-shop manager authorization remains organization-bound through `assertShopInScope`.
- Global and organization shop listings now restrict staff and one-shop managers to the shop IDs from `resolveShopScope`.
- Added regression coverage for owner organization access plus both restricted listing endpoints.

## Verification

- `npm test -- "src/modules/auth/shop-access.integration.test.ts"` passed: 35 tests, 0 failures.
- `npm run build` remains blocked by the existing `src/index.ts` unresolved `cors` module/type declaration (`TS2307`).

## Concern

The TypeScript build failure is unrelated to the Task 6 files and matches the previously recorded project dependency issue.
