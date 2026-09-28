ALTER TABLE "SupplierProductPricing"
ADD COLUMN "netMarginPercentage" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "roiPercentage" DECIMAL(65,30) NOT NULL DEFAULT 0;

UPDATE "SupplierProductPricing"
SET "netMarginPercentage" = CASE
      WHEN "finalPriceArs" > 0 THEN ("targetProfitArs" / "finalPriceArs") * 100
      ELSE 0
    END,
    "roiPercentage" = CASE
      WHEN "totalCostArs" > 0 THEN ("targetProfitArs" / "totalCostArs") * 100
      ELSE 0
    END;
