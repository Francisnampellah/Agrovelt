-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('MNYAMA_SHOP', 'CUSTOM');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "mnyamaShopDocId" TEXT,
ADD COLUMN     "source" "ProductSource" NOT NULL DEFAULT 'CUSTOM';

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "source" "ProductSource" NOT NULL DEFAULT 'CUSTOM';

-- CreateIndex
CREATE UNIQUE INDEX "Product_mnyamaShopDocId_key" ON "Product"("mnyamaShopDocId");

