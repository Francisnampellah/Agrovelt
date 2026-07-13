# Task 10 — End-to-end verification report

## Automated verification

- `npm run prisma:generate`: passed. Prisma Client 5.22.0 generated from `prisma/schema.prisma`.
- `npm test`: passed — 43 tests, 43 passed, 0 failed (24.1 s).
- The schema defines `Role.MANAGER`, `ManagerAccess` (`ONE_SHOP`, `ALL_SHOPS`), and nullable `User.managerAccess`.
- Migration `prisma/migrations/20260713120000_add_manager_role_and_access/migration.sql` exists. It adds `MANAGER` to `Role`, creates `ManagerAccess`, and adds `User.managerAccess`.
- Live migration status could not be verified: `npx prisma migrate status` returned P1001 because PostgreSQL at `localhost:5433` was unavailable. Apply and verify the migration against the target database before release.

## Checklist coverage

1. **OWNER creates STAFF with one shop** — unit test proves `createOrgUser` creates one `ShopStaff` record and leaves `managerAccess` null; scope unit test proves STAFF scope contains only its assigned shop. Live DB/API check remains needed for the persisted profile response.
2. **STAFF isolation and restrictions** — unit tests prove assigned-shop listing, an out-of-scope sale returns 403, and STAFF cannot purchase or add stock. A live API/database check remains needed to exercise actual route middleware and persistence for purchase/stock endpoints.
3. **ALL_SHOPS MANAGER funding** — unit tests prove the authorization decision permits ALL_SHOPS managers and creates the funding entry shape. A live request is still needed to confirm the complete funding route and database write.
4. **ONE_SHOP MANAGER restrictions** — unit tests prove funding is denied, scope is restricted to the assigned shop, and stock permission is denied outside scope. A live request is still needed to confirm 403 responses for the funding and stock routes.
5. **Firebase exchange preserves STAFF role** — unit test proves both STAFF and MANAGER local roles are preserved rather than elevated to OWNER. A live Firebase exchange remains needed to verify token validation and actual user update behavior.

## Integration-style coverage

Existing controller/middleware tests use in-memory Prisma doubles to verify shop-list scoping and an out-of-scope sale 403. This strengthens the unit coverage without a database; no additional thin test was needed.
