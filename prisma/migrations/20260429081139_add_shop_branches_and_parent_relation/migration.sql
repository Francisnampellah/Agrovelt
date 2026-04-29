/*
  Warnings:

  - A unique constraint covering the columns `[firebaseUid]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "clientType" TEXT,
ADD COLUMN     "deviceId" TEXT;

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "firebaseUid" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
