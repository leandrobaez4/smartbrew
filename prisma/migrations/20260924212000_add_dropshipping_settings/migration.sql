CREATE TABLE "DropshippingSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "minimumMargin" DECIMAL(65,30) NOT NULL DEFAULT 20,
    "minimumProfit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "minimumStock" INTEGER NOT NULL DEFAULT 1,
    "autoPublish" BOOLEAN NOT NULL DEFAULT false,
    "autoUpdatePrices" BOOLEAN NOT NULL DEFAULT false,
    "autoPauseNoStock" BOOLEAN NOT NULL DEFAULT true,
    "autoSupplierPurchase" BOOLEAN NOT NULL DEFAULT false,
    "priceChangeLimit" DECIMAL(65,30) NOT NULL DEFAULT 20,
    "supplierSyncInterval" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DropshippingSettings_pkey" PRIMARY KEY ("id")
);
