-- Baseline generated from prisma/schema.prisma after production had already
-- been provisioned manually. Existing databases must mark this migration as
-- applied; new databases can replay it from scratch.
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "ProductStatus" AS ENUM ('CANDIDATE', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "ProductAIStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'APPROVED', 'REJECTED', 'PUBLISHING', 'PUBLISHED', 'ERROR');
CREATE TYPE "AssetKind" AS ENUM ('SOURCE_IMAGE', 'COVER', 'REEL');
CREATE TYPE "PublicationStatus" AS ENUM ('QUEUED', 'UPLOADING', 'PROCESSING', 'PUBLISHED', 'FAILED');
CREATE TYPE "JobStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortalMember" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "inviteHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "reviewTokenHash" TEXT,
    "reviewExpiresAt" TIMESTAMP(3),
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "loginWindowEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortalMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortalSession" (
    "tokenHash" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "oauthStateHash" TEXT,
    "oauthExpiresAt" TIMESTAMP(3),
    CONSTRAINT "PortalSession_pkey" PRIMARY KEY ("tokenHash")
);

CREATE TABLE "InstagramConnection" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "instagramId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InstagramConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewPublication" (
    "memberId" TEXT NOT NULL,
    "instagramId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "containerId" TEXT,
    "mediaId" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewPublication_pkey" PRIMARY KEY ("memberId")
);

CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL DEFAULT 'MERCADO_LIBRE',
    "externalId" TEXT,
    "siteId" TEXT NOT NULL DEFAULT 'MLA',
    "title" TEXT NOT NULL,
    "originalTitle" TEXT,
    "originalDescription" TEXT,
    "displayTitle" TEXT,
    "shortDescription" TEXT,
    "description" TEXT,
    "whyWePickedIt" JSONB,
    "idealFor" TEXT,
    "highlights" JSONB,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "slug" TEXT,
    "aiStatus" "ProductAIStatus" NOT NULL DEFAULT 'PENDING',
    "aiError" TEXT,
    "categoryId" TEXT,
    "price" DECIMAL(65,30),
    "currencyId" TEXT,
    "originalPermalink" TEXT NOT NULL,
    "affiliateUrl" TEXT,
    "primaryImageUrl" TEXT,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attributesJson" JSONB,
    "sellerId" TEXT,
    "sellerReputation" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'CANDIDATE',
    "opportunityScore" INTEGER,
    "priceTier" TEXT,
    "problemSolved" TEXT,
    "reelHook" TEXT,
    "explanationDifficulty" TEXT,
    "selectionReasons" JSONB,
    "lastMarketplaceSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE "ContentDraft" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "hook" TEXT,
    "benefitsJson" JSONB,
    "disclaimer" TEXT,
    "caption" TEXT,
    "hashtagsJson" JSONB,
    "cta" TEXT,
    "priceSnapshot" DECIMAL(65,30),
    "currencySnapshot" TEXT,
    "template" TEXT NOT NULL DEFAULT 'STATIC_CARDS_V1',
    "status" "DraftStatus" NOT NULL DEFAULT 'DRAFT',
    "validationErrorsJson" JSONB,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContentDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "contentDraftId" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "localPath" TEXT,
    "publicUrl" TEXT,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" DOUBLE PRECISION,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "contentDraftId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'INSTAGRAM',
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "externalContainerId" TEXT,
    "externalMediaId" TEXT,
    "externalPermalink" TEXT,
    "deletedAt" TIMESTAMP(3),
    "status" "PublicationStatus" NOT NULL DEFAULT 'QUEUED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobExecution" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "status" "JobStatus" NOT NULL,
    "inputJson" JSONB,
    "outputJson" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "JobExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HtmlImportJob" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "productsFound" INTEGER NOT NULL DEFAULT 0,
    "productsImported" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HtmlImportJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "PortalMember_email_key" ON "PortalMember"("email");
CREATE UNIQUE INDEX "PortalMember_inviteHash_key" ON "PortalMember"("inviteHash");
CREATE UNIQUE INDEX "PortalMember_reviewTokenHash_key" ON "PortalMember"("reviewTokenHash");
CREATE UNIQUE INDEX "PortalSession_oauthStateHash_key" ON "PortalSession"("oauthStateHash");
CREATE INDEX "PortalSession_memberId_idx" ON "PortalSession"("memberId");
CREATE UNIQUE INDEX "InstagramConnection_memberId_key" ON "InstagramConnection"("memberId");
CREATE UNIQUE INDEX "InstagramConnection_instagramId_key" ON "InstagramConnection"("instagramId");
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE UNIQUE INDEX "Product_marketplace_externalId_key" ON "Product"("marketplace", "externalId");
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "CollectionProduct_productId_idx" ON "CollectionProduct"("productId");
CREATE UNIQUE INDEX "CollectionProduct_collectionId_position_key" ON "CollectionProduct"("collectionId", "position");

ALTER TABLE "PortalSession" ADD CONSTRAINT "PortalSession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "PortalMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstagramConnection" ADD CONSTRAINT "InstagramConnection_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "PortalMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionProduct" ADD CONSTRAINT "CollectionProduct_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionProduct" ADD CONSTRAINT "CollectionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentDraft" ADD CONSTRAINT "ContentDraft_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "ContentDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "ContentDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
