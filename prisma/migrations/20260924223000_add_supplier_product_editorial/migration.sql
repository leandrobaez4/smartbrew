CREATE TYPE "SupplierProductEditorialStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'READY',
  'APPROVED',
  'REJECTED',
  'FAILED'
);

ALTER TABLE "SupplierProduct"
  ADD COLUMN "editorialTitle" TEXT,
  ADD COLUMN "editorialDescription" TEXT,
  ADD COLUMN "editorialBulletPoints" JSONB,
  ADD COLUMN "editorialHighlights" JSONB,
  ADD COLUMN "editorialSeoKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "editorialStatus" "SupplierProductEditorialStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "editorialError" TEXT,
  ADD COLUMN "editorialGeneratedAt" TIMESTAMP(3),
  ADD COLUMN "editorialReviewedAt" TIMESTAMP(3);

CREATE INDEX "SupplierProduct_editorialStatus_idx"
ON "SupplierProduct"("editorialStatus");
