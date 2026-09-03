-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('CANDIDATE', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'APPROVED', 'REJECTED', 'PUBLISHING', 'PUBLISHED', 'ERROR');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('SOURCE_IMAGE', 'COVER', 'REEL');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('QUEUED', 'UPLOADING', 'PROCESSING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL DEFAULT 'MERCADO_LIBRE',
    "externalId" TEXT,
    "siteId" TEXT NOT NULL DEFAULT 'MLA',
    "title" TEXT NOT NULL,
    "categoryId" TEXT,
    "price" DECIMAL(65,30),
    "currencyId" TEXT,
    "originalPermalink" TEXT NOT NULL,
    "affiliateUrl" TEXT,
    "primaryImageUrl" TEXT,
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "contentDraftId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'INSTAGRAM',
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "externalContainerId" TEXT,
    "externalMediaId" TEXT,
    "externalPermalink" TEXT,
    "status" "PublicationStatus" NOT NULL DEFAULT 'QUEUED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Product_marketplace_externalId_key" ON "Product"("marketplace", "externalId");

-- AddForeignKey
ALTER TABLE "ContentDraft" ADD CONSTRAINT "ContentDraft_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "ContentDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "ContentDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

