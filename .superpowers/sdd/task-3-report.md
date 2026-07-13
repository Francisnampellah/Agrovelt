# Task 3 Report: Org user management service

**Status:** Complete with a pre-existing build dependency issue  
**Branch:** `feat/user-shop-roles`
**Commit:** `add1312` — feat(org): add owner-scoped user create/list/update/deactivate service

## Summary

Added `OrgUsersService` with owner-scoped create, list, update, and deactivation operations for `STAFF` and `MANAGER` users.

## Validation and authorization

- User management requires `canManageUsers`; an `OWNER` must act within their own organization.
- `STAFF` requires `shopId` and cannot receive `managerAccess`.
- `MANAGER` requires `managerAccess`; `ONE_SHOP` requires `shopId`, while `ALL_SHOPS` rejects it.
- Every supplied shop is verified as belonging to the target organization.
- Updates replace prior `ShopStaff` assignments, maintaining one row for `STAFF` and `ONE_SHOP` managers, and none for `ALL_SHOPS` managers.

## Tests

- Added the seven specified create-path cases plus coverage for listing, deactivating, and switching a manager to `ALL_SHOPS`.
- `npm test` passed: 30 tests, 0 failures.

## Concern

`npm run build` is blocked by the existing `src/index.ts` import error: TypeScript cannot resolve `cors` or its declarations. This task did not modify that file or its dependencies.

## Review fix: listOrgUsers authorization

**Commit:** `105826e` — fix(org): require auth for listOrgUsers

**Change:** `listOrgUsers` now accepts `actor: AuthActor` and calls `assertCanManageUsers(actor, orgId)` before querying, matching create/update/deactivate. STAFF and MANAGER actors are rejected.

**Test added:** `listOrgUsers rejects actors without user-management permission`

**Test output:**
```
✔ createOrgUser rejects STAFF without shopId
✔ createOrgUser creates STAFF with one ShopStaff assignment and no manager access
✔ createOrgUser rejects ALL_SHOPS manager with shopId
✔ createOrgUser rejects ONE_SHOP manager without shopId
✔ createOrgUser creates ALL_SHOPS manager without ShopStaff assignments
✔ createOrgUser rejects actors without user-management permission
✔ createOrgUser rejects shops outside the organization
✔ updateOrgUser removes ShopStaff rows when switching to ALL_SHOPS
✔ listOrgUsers includes each user shop assignment and manager access
✔ listOrgUsers rejects actors without user-management permission
✔ deactivateOrgUser marks the organization user inactive
ℹ tests 11 | pass 11 | fail 0
```
