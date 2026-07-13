### Task 1: Schema — MANAGER role + managerAccess

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260713120000_add_manager_role_and_access/migration.sql`
- Test: `src/modules/auth/permissions.test.ts` (created empty-ready in Task 2; this task only verifies migrate/generate)

**Interfaces:**
- Produces: Prisma enum `Role.MANAGER`, enum `ManagerAccess { ONE_SHOP ALL_SHOPS }`, field `User.managerAccess ManagerAccess?`

- [ ] **Step 1: Update Prisma schema**

In `prisma/schema.prisma`, change Role enum to:

```prisma
enum Role {
  SUPER_ADMIN
  ADMIN
  OWNER
  MANAGER
  STAFF
}

enum ManagerAccess {
  ONE_SHOP
  ALL_SHOPS
}
```

On `model User`, add after `role`:

```prisma
  managerAccess  ManagerAccess?
```

- [ ] **Step 2: Add migration SQL**

Create `prisma/migrations/20260713120000_add_manager_role_and_access/migration.sql`:

```sql
-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MANAGER';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ManagerAccess" AS ENUM ('ONE_SHOP', 'ALL_SHOPS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "managerAccess" "ManagerAccess";
```

- [ ] **Step 3: Generate client**

Run: `npx prisma generate`  
Expected: success, client includes `MANAGER` and `ManagerAccess`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260713120000_add_manager_role_and_access
git commit -m "feat(auth): add MANAGER role and managerAccess to schema"
```

---
