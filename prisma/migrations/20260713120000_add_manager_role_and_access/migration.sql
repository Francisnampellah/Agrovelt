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
