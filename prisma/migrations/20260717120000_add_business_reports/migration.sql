-- CreateTable
CREATE TABLE "BusinessReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "generatedByUserId" TEXT NOT NULL,
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "shopIds" JSONB NOT NULL,
    "request" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessReport_organizationId_createdAt_idx" ON "BusinessReport"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "BusinessReport" ADD CONSTRAINT "BusinessReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessReport" ADD CONSTRAINT "BusinessReport_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
