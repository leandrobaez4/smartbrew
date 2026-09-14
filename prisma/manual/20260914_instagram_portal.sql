-- Additive portal schema only. Execute once, within a transaction.
CREATE TABLE "public"."PortalMember" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT,
  "inviteHash" TEXT,
  "inviteExpiresAt" TIMESTAMP(3),
  "disabled" BOOLEAN NOT NULL DEFAULT false,
  "loginAttempts" INTEGER NOT NULL DEFAULT 0,
  "loginWindowEnd" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalMember_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "public"."PortalSession" (
  "tokenHash" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "oauthStateHash" TEXT,
  "oauthExpiresAt" TIMESTAMP(3),
  CONSTRAINT "PortalSession_pkey" PRIMARY KEY ("tokenHash")
);
CREATE TABLE "public"."InstagramConnection" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "instagramId" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "encryptedToken" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstagramConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PortalMember_email_key" ON "public"."PortalMember"("email");
CREATE UNIQUE INDEX "PortalMember_inviteHash_key" ON "public"."PortalMember"("inviteHash");
CREATE UNIQUE INDEX "PortalSession_oauthStateHash_key" ON "public"."PortalSession"("oauthStateHash");
CREATE INDEX "PortalSession_memberId_idx" ON "public"."PortalSession"("memberId");
CREATE UNIQUE INDEX "InstagramConnection_memberId_key" ON "public"."InstagramConnection"("memberId");
CREATE UNIQUE INDEX "InstagramConnection_instagramId_key" ON "public"."InstagramConnection"("instagramId");
ALTER TABLE "public"."PortalSession" ADD CONSTRAINT "PortalSession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."PortalMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."InstagramConnection" ADD CONSTRAINT "InstagramConnection_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."PortalMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
