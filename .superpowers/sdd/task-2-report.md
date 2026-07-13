# Task 2 Report: Shop scope resolver + permission helpers

## Delivered

- Added `permissions.ts` with the requested `AuthActor` type and all permission helpers.
- Added `shopScope.ts` with `resolveShopScope` and `assertShopInScope`.
- Added focused node:test coverage for STAFF, ONE_SHOP manager, ALL_SHOPS manager, and OWNER scopes.
- `assertShopInScope` allows platform admins globally and verifies that OWNER/ALL_SHOPS manager shop access belongs to the persisted user's organization.
- Re-exported the new helpers through `src/modules/auth/index.ts`.
- The existing `npm test` script already includes `src/**/*.test.ts`, so no package change was needed.

## TDD evidence

1. `permissions.test.ts` initially failed with TS2307 because `./permissions` did not exist.
2. `shopScope.test.ts` initially failed with TS2307 because `./shopScope` did not exist.
3. Implementations were then added and focused tests passed.

## Verification

- Focused: `node --require ts-node/register --test src/modules/auth/permissions.test.ts src/modules/auth/shopScope.test.ts`
  - 10 passed, 0 failed.
- Full: `npm test`
  - 20 passed, 0 failed.
- Lint diagnostics: no errors in changed auth files.
- Build: `npm run build` remains blocked by pre-existing `src/index.ts(4,18): TS2307 Cannot find module 'cors' or its corresponding type declarations.`

## Self-review

- Permission decisions match the task’s specified role matrix.
- All-shop scope queries are limited to the persisted user organization.
- All-shop assertion performs an explicit organization membership check, preventing cross-organization access even when `allShops` is true.
