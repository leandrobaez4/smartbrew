CREATE TABLE "SupplierProduct" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sku" TEXT,
    "ean" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "category" TEXT,
    "cost" DECIMAL(65,30),
    "currency" TEXT,
    "stock" INTEGER,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attributes" JSONB,
    "rawData" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierProduct_supplierId_externalId_key" ON "SupplierProduct"("supplierId", "externalId");
CREATE INDEX "SupplierProduct_supplierId_idx" ON "SupplierProduct"("supplierId");
CREATE INDEX "SupplierProduct_externalId_idx" ON "SupplierProduct"("externalId");
CREATE INDEX "SupplierProduct_sku_idx" ON "SupplierProduct"("sku");
CREATE INDEX "SupplierProduct_ean_idx" ON "SupplierProduct"("ean");

ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
