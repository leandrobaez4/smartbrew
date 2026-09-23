-- Editorial product data is additive so existing public/admin flows remain compatible.
CREATE TYPE "ProductAIStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

ALTER TABLE "Product"
  ADD COLUMN "originalTitle" TEXT,
  ADD COLUMN "originalDescription" TEXT,
  ADD COLUMN "displayTitle" TEXT,
  ADD COLUMN "shortDescription" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "whyWePickedIt" JSONB,
  ADD COLUMN "idealFor" TEXT,
  ADD COLUMN "highlights" JSONB,
  ADD COLUMN "seoTitle" TEXT,
  ADD COLUMN "seoDescription" TEXT,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "aiStatus" "ProductAIStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "aiError" TEXT;

UPDATE "Product" SET "originalTitle" = "title" WHERE "originalTitle" IS NULL;

CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
