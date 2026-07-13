# Task 4 Report: Org user HTTP routes and controller

**Status:** Complete with a pre-existing build dependency issue  
**Branch:** `feat/user-shop-roles`  
**Commit:** `46cfa4b` — `feat(org): expose OWNER user management HTTP APIs`

## Summary

Added `OrgUsersController` and authenticated organization-user routes:

- `POST /api/organizations/:id/users`
- `GET /api/organizations/:id/users`
- `PATCH /api/organizations/:id/users/:userId`
- `POST /api/organizations/:id/users/:userId/deactivate`

The controller validates create/update payloads, reconstructs the actor from JWT data plus the current database `managerAccess` and organization assignment, and maps authorization failures to `403`, missing users/shops to `404`, and validation/domain failures to `400`. The list handler passes the authenticated actor to `listOrgUsers(actor, orgId)`.

The organization module now exports and constructs `OrgUsersService` and `OrgUsersController`; the OpenAPI annotations describe all four endpoints.

## Verification

- `npm test -- --test-name-pattern="OrgUsersService"` passed: 31 tests, 0 failures.
- `npx tsc --noEmit` reports only the existing `src/index.ts` missing-module error for `cors`; it reports no `org-users` errors.

## Concern

The complete TypeScript build remains blocked because TypeScript cannot resolve the existing `cors` import or its declaration in `src/index.ts`. This task did not modify that file or the dependency installation.
