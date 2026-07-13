# Review Package Task 1
BASE: a42bb9d026e4d212ffe4dad0b593d8c51e7e72f1
HEAD: d0b0262f88b28aab28c55fee4590f25b30b1a86b

## Commits
d0b0262 feat(auth): add MANAGER role and managerAccess to schema

## Stat
 .../20260713120000_add_manager_role_and_access/migration.sql | 12 ++++++++++++
 prisma/schema.prisma                                         |  7 +++++++
 2 files changed, 19 insertions(+)

## Diff
```diff
diff --git a/prisma/migrations/20260713120000_add_manager_role_and_access/migration.sql b/prisma/migrations/20260713120000_add_manager_role_and_access/migration.sql
new file mode 100644
index 0000000..be12e9e
--- /dev/null
+++ b/prisma/migrations/20260713120000_add_manager_role_and_access/migration.sql
@@ -0,0 +1,12 @@
+-- AlterEnum
+ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MANAGER';
+
+-- CreateEnum
+DO $$ BEGIN
+  CREATE TYPE "ManagerAccess" AS ENUM ('ONE_SHOP', 'ALL_SHOPS');
+EXCEPTION
+  WHEN duplicate_object THEN null;
+END $$;
+
+-- AlterTable
+ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "managerAccess" "ManagerAccess";
diff --git a/prisma/schema.prisma b/prisma/schema.prisma
index 31a838f..6860b40 100644
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ -8,23 +8,29 @@ generator client {
 }
 
 // ------------------------------------------------------
 // ENUMS
 // ------------------------------------------------------
 
 enum Role {
   SUPER_ADMIN
   ADMIN
   OWNER
+  MANAGER
   STAFF
 }
 
+enum ManagerAccess {
+  ONE_SHOP
+  ALL_SHOPS
+}
+
 enum ShopType {
   MAIN
   BRANCH
 }
 
 enum PaymentMethod {
   CASH
   CARD
   MOBILE
 }
@@ -87,20 +93,21 @@ model Organization {
 // ------------------------------------------------------
 
 model User {
   id             String   @id @default(uuid())
   firebaseUid    String?  @unique
   organizationId String? // Optional because SUPER_ADMIN doesn't belong to any org
   name           String
   email          String   @unique
   passwordHash   String?
   role           Role // SUPER_ADMIN, OWNER, ADMIN, STAFF
+  managerAccess  ManagerAccess?
   isActive       Boolean  @default(true)
   createdAt      DateTime @default(now())
 
   organization Organization? @relation(fields: [organizationId], references: [id])
   // Shops owned by this user (owner relationship)
   shopsOwned    Shop[]
   staffIn       ShopStaff[]
 
   auditLogs     AuditLog[]
   refreshTokens RefreshToken[]
```
