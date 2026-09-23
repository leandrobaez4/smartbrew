-- Collections are editorial groupings with an explicit, stable product order.
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "image" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CollectionProduct" (
    "collectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CollectionProduct_pkey" PRIMARY KEY ("collectionId", "productId")
);

CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE UNIQUE INDEX "CollectionProduct_collectionId_position_key" ON "CollectionProduct"("collectionId", "position");
CREATE INDEX "CollectionProduct_productId_idx" ON "CollectionProduct"("productId");

ALTER TABLE "CollectionProduct"
    ADD CONSTRAINT "CollectionProduct_collectionId_fkey"
    FOREIGN KEY ("collectionId") REFERENCES "Collection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CollectionProduct"
    ADD CONSTRAINT "CollectionProduct_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
