CREATE TYPE "MarketplaceListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'ERROR');

CREATE TABLE "MarketplaceListing" (
    "id" TEXT NOT NULL,
    "supplierProductId" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL,
    "marketplaceItemId" TEXT,
    "marketplaceAccountId" TEXT NOT NULL,
    "price" DECIMAL(65,30),
    "status" "MarketplaceListingStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceListing_supplierProductId_marketplace_marketplaceAccountId_key" ON "MarketplaceListing"("supplierProductId", "marketplace", "marketplaceAccountId");
CREATE UNIQUE INDEX "MarketplaceListing_marketplace_marketplaceAccountId_marketplaceItemId_key" ON "MarketplaceListing"("marketplace", "marketplaceAccountId", "marketplaceItemId");
CREATE INDEX "MarketplaceListing_supplierProductId_idx" ON "MarketplaceListing"("supplierProductId");
CREATE INDEX "MarketplaceListing_marketplaceItemId_idx" ON "MarketplaceListing"("marketplaceItemId");
CREATE INDEX "MarketplaceListing_status_idx" ON "MarketplaceListing"("status");
CREATE INDEX "MarketplaceListing_lastSyncAt_idx" ON "MarketplaceListing"("lastSyncAt");

ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_supplierProductId_fkey" FOREIGN KEY ("supplierProductId") REFERENCES "SupplierProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
