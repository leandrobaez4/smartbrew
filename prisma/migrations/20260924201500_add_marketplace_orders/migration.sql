CREATE TYPE "MarketplaceWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'ERROR');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'SUPPLIER_PENDING', 'SUPPLIER_PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'ERROR');

CREATE TABLE "MarketplaceWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "resourceData" JSONB,
    "status" "MarketplaceWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketplaceWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL,
    "marketplaceOrderId" TEXT NOT NULL,
    "marketplaceAccountId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierProductId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "salePrice" DECIMAL(65,30) NOT NULL,
    "supplierCost" DECIMAL(65,30) NOT NULL,
    "profit" DECIMAL(65,30) NOT NULL,
    "customerData" JSONB NOT NULL,
    "shippingData" JSONB NOT NULL,
    "supplierOrderId" TEXT,
    "supplierResponse" JSONB,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" TEXT,
    "shippingStatus" TEXT,
    "currency" TEXT,
    "buyerId" TEXT,
    "rawData" JSONB NOT NULL,
    "orderedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceWebhookEvent_eventKey_key" ON "MarketplaceWebhookEvent"("eventKey");
CREATE INDEX "MarketplaceWebhookEvent_topic_idx" ON "MarketplaceWebhookEvent"("topic");
CREATE INDEX "MarketplaceWebhookEvent_status_idx" ON "MarketplaceWebhookEvent"("status");
CREATE UNIQUE INDEX "Order_marketplaceOrderId_key" ON "Order"("marketplaceOrderId");
CREATE INDEX "Order_supplierId_idx" ON "Order"("supplierId");
CREATE INDEX "Order_supplierProductId_idx" ON "Order"("supplierProductId");
CREATE INDEX "Order_listingId_idx" ON "Order"("listingId");
CREATE INDEX "Order_supplierOrderId_idx" ON "Order"("supplierOrderId");
CREATE INDEX "Order_status_idx" ON "Order"("status");

ALTER TABLE "Order" ADD CONSTRAINT "Order_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_supplierProductId_fkey" FOREIGN KEY ("supplierProductId") REFERENCES "SupplierProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
