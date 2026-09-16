-- Additive only. Apply before deploying the new Prisma Client/application.
ALTER TABLE "PortalMember" ADD COLUMN IF NOT EXISTS "reviewTokenHash" TEXT;
ALTER TABLE "PortalMember" ADD COLUMN IF NOT EXISTS "reviewExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "PortalMember_reviewTokenHash_key" ON "PortalMember"("reviewTokenHash");
