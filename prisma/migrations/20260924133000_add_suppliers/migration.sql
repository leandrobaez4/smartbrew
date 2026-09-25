CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR');
CREATE TYPE "SupplierIntegrationType" AS ENUM ('API', 'CSV', 'XML', 'MANUAL', 'SCRAPING');

CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT,
    "website" TEXT,
    "apiUrl" TEXT,
    "apiKeyEncrypted" TEXT,
    "apiSecretEncrypted" TEXT,
    "usernameEncrypted" TEXT,
    "passwordEncrypted" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "integrationType" "SupplierIntegrationType" NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Supplier_slug_key" ON "Supplier"("slug");
CREATE INDEX "Supplier_status_idx" ON "Supplier"("status");
CREATE INDEX "Supplier_integrationType_idx" ON "Supplier"("integrationType");
