ALTER TABLE "SupplierProductPricing"
ADD COLUMN "supplierCurrency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN "internalTaxAmountUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "internalTaxAmountArs" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "supplierCostWithTaxesUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "supplierCostWithTaxesArs" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "supplierPvpUsd" DECIMAL(65,30),
ADD COLUMN "supplierPvpArs" DECIMAL(65,30),
ADD COLUMN "supplierMarkupPercentage" DECIMAL(65,30),
ADD COLUMN "supplierPricingUpdatedAt" TIMESTAMP(3);

UPDATE "SupplierProductPricing"
SET "supplierCostWithTaxesUsd" = "supplierCostWithVatUsd",
    "supplierCostWithTaxesArs" = "supplierCostWithVatArs";

ALTER TABLE "SupplierProductHistory"
ADD COLUMN "supplierCurrency" TEXT,
ADD COLUMN "supplierPriceUsd" DECIMAL(65,30),
ADD COLUMN "exchangeRateArsPerUsd" DECIMAL(65,30),
ADD COLUMN "vatPercentage" DECIMAL(65,30),
ADD COLUMN "internalTaxAmountArs" DECIMAL(65,30),
ADD COLUMN "supplierCostWithTaxesArs" DECIMAL(65,30);
