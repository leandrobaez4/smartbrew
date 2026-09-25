CREATE TABLE "SupplierProductHistory" (
  "id" TEXT NOT NULL,
  "supplierProductId" TEXT NOT NULL,
  "cost" DECIMAL(65,30),
  "stock" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierProductHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierProductHistory_supplierProductId_createdAt_idx"
ON "SupplierProductHistory"("supplierProductId", "createdAt");

ALTER TABLE "SupplierProductHistory"
ADD CONSTRAINT "SupplierProductHistory_supplierProductId_fkey"
FOREIGN KEY ("supplierProductId") REFERENCES "SupplierProduct"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
