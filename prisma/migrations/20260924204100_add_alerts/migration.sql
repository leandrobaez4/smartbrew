CREATE TYPE "AlertType" AS ENUM (
  'SUPPLIER_OUT_OF_STOCK',
  'SUPPLIER_PRICE_INCREASE',
  'LOW_MARGIN',
  'PRICE_ANOMALY',
  'SUPPLIER_API_ERROR',
  'ORDER_CREATION_ERROR',
  'MARKETPLACE_SYNC_ERROR'
);

CREATE TABLE "Alert" (
  "id" TEXT NOT NULL,
  "type" "AlertType" NOT NULL,
  "origin" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "message" TEXT NOT NULL,
  "details" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Alert_readAt_createdAt_idx" ON "Alert"("readAt", "createdAt");
CREATE INDEX "Alert_type_createdAt_idx" ON "Alert"("type", "createdAt");
CREATE INDEX "Alert_entityType_entityId_idx" ON "Alert"("entityType", "entityId");
