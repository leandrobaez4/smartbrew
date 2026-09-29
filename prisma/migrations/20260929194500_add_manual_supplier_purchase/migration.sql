ALTER TABLE "Order"
ADD COLUMN "actualSupplierCost" DECIMAL(65,30),
ADD COLUMN "manualPurchaseReference" TEXT,
ADD COLUMN "manualPurchaseError" TEXT,
ADD COLUMN "manualPurchaseCompletedAt" TIMESTAMP(3),
ADD COLUMN "manualPurchaseUpdatedAt" TIMESTAMP(3);
