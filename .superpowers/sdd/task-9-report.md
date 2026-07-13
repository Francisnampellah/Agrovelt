# Task 9: Register validation + swagger + STAFF multi-shop cleanup note — Report

## Status

Completed and committed.

## Implementation

- Tightened `registerValidation` in `auth.controller.ts`: MANAGER remains excluded from allowed roles; STAFF without `shopId` is rejected with a message directing callers to `POST /api/organizations/{id}/users`.
- Added `MANAGER` to the shared `User.role` enum in `src/config/swagger.ts`. Org user endpoints were already documented in `organization.swagger.ts`.
- Added optional audit script `scripts/audit-multi-shop-staff.ts` listing STAFF users with more than one `ShopStaff` row.

## Tests

- `npm test` passed: 40 tests.
- `npm run build` passed.

## Commit

`4f0eaac docs(auth): document MANAGER role and tighten public register`

## Concerns

- Public register still accepts STAFF when `shopId` is supplied, but `auth.service.register` does not create `ShopStaff` — legacy path only; org user API is the supported flow.
- `src/routes/auth.ts` inline register swagger still omits `MANAGER` and STAFF shopId notes (out of this task's commit scope).

---

## Follow-up fix (Task 9 review — Important)

**Status:** Completed and committed.

**Changes:**
- `registerValidation` now allows only `SUPER_ADMIN`, `ADMIN`, `OWNER` (STAFF/MANAGER rejected).
- Removed STAFF `shopId` custom validator from public register path.
- `auth.service.register` defaults omitted role to `OWNER` and rejects STAFF/MANAGER with org user API message.
- Updated register swagger in `auth.swagger.ts`, `routes/auth.ts`, and `routes/users.ts` (shared validation).
- Added `auth.controller.register.test.ts` (3 validation tests).

**Tests:** `npm test` passed — 43 tests.

**Commit:** `13b2d87 fix(auth): block STAFF/MANAGER on public register`

**Resolved concern:** Orphaned STAFF via public register with `shopId` is no longer possible; STAFF/MANAGER must use `POST /api/organizations/{id}/users`.
