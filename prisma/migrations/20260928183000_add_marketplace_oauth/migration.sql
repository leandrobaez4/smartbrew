CREATE TABLE "MarketplaceOAuthCredential" (
  "accountId" TEXT NOT NULL,
  "marketplace" TEXT NOT NULL DEFAULT 'MERCADO_LIBRE',
  "accessTokenEncrypted" TEXT NOT NULL,
  "refreshTokenEncrypted" TEXT NOT NULL,
  "tokenType" TEXT NOT NULL DEFAULT 'bearer',
  "scope" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastRefreshAt" TIMESTAMP(3),
  "lastRefreshError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceOAuthCredential_pkey" PRIMARY KEY ("accountId")
);

CREATE TABLE "MarketplaceOAuthState" (
  "stateHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceOAuthState_pkey" PRIMARY KEY ("stateHash")
);

CREATE INDEX "MarketplaceOAuthCredential_marketplace_expiresAt_idx"
ON "MarketplaceOAuthCredential"("marketplace", "expiresAt");

CREATE INDEX "MarketplaceOAuthState_expiresAt_idx"
ON "MarketplaceOAuthState"("expiresAt");
