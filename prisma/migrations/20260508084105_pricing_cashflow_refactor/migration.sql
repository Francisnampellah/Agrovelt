/*
  Warnings:

  - You are about to drop the column `sellingPrice` on the `Inventory` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('COST', 'SELLING', 'MIN_SELLING');

-- CreateEnum
CREATE TYPE "CashFlowDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "CashFlowCategory" AS ENUM ('SALE', 'PURCHASE', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'REFUND');

-- AlterTable
ALTER TABLE "Inventory" DROP COLUMN "sellingPrice";

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "defaultCostPrice" DOUBLE PRECISION,
ADD COLUMN     "defaultSellingPrice" DOUBLE PRECISION,
ADD COLUMN     "markupPercent" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ShopVariantPrice" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "sellingPrice" DOUBLE PRECISION NOT NULL,
    "minSellingPrice" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "ShopVariantPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "shopId" TEXT,
    "variantId" TEXT NOT NULL,
    "priceType" "PriceType" NOT NULL,
    "oldPrice" DOUBLE PRECISION NOT NULL,
    "newPrice" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashFlowEntry" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "direction" "CashFlowDirection" NOT NULL,
    "category" "CashFlowCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "referenceId" TEXT,
    "note" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashFlowEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopVariantPrice_shopId_variantId_key" ON "ShopVariantPrice"("shopId", "variantId");

-- AddForeignKey
ALTER TABLE "ShopVariantPrice" ADD CONSTRAINT "ShopVariantPrice_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopVariantPrice" ADD CONSTRAINT "ShopVariantPrice_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashFlowEntry" ADD CONSTRAINT "CashFlowEntry_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
