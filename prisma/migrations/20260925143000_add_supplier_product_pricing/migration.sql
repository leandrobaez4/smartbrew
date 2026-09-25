CREATE TABLE "SupplierProductPricing" (
    "id" TEXT NOT NULL,
    "supplierProductId" TEXT NOT NULL,
    "supplierPriceUsd" DECIMAL(65,30) NOT NULL,
    "exchangeRateArsPerUsd" DECIMAL(65,30) NOT NULL,
    "supplierPriceArs" DECIMAL(65,30) NOT NULL,
    "vatPercentage" DECIMAL(65,30) NOT NULL,
    "vatAmountUsd" DECIMAL(65,30) NOT NULL,
    "vatAmountArs" DECIMAL(65,30) NOT NULL,
    "supplierCostWithVatUsd" DECIMAL(65,30) NOT NULL,
    "supplierCostWithVatArs" DECIMAL(65,30) NOT NULL,
    "productSearchCostArs" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "shippingCostArs" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "marketplaceFeePercentage" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "marketplaceFixedFeeArs" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "marketplaceFeeAmountArs" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "marketplaceCategoryId" TEXT,
    "marketplaceListingTypeId" TEXT NOT NULL DEFAULT 'gold_special',
    "marketplaceFeeSyncedAt" TIMESTAMP(3),
    "targetMarginPercentage" DECIMAL(65,30) NOT NULL DEFAULT 20,
    "targetProfitArs" DECIMAL(65,30) NOT NULL,
    "totalCostArs" DECIMAL(65,30) NOT NULL,
    "finalPriceArs" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierProductPricing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierProductPricing_supplierProductId_key" ON "SupplierProductPricing"("supplierProductId");
CREATE INDEX "SupplierProductPricing_marketplaceFeeSyncedAt_idx" ON "SupplierProductPricing"("marketplaceFeeSyncedAt");
CREATE INDEX "SupplierProductPricing_marketplaceCategoryId_idx" ON "SupplierProductPricing"("marketplaceCategoryId");

ALTER TABLE "SupplierProductPricing" ADD CONSTRAINT "SupplierProductPricing_supplierProductId_fkey" FOREIGN KEY ("supplierProductId") REFERENCES "SupplierProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
