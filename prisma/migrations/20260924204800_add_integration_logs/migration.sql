CREATE TYPE "IntegrationLogStatus" AS ENUM ('SUCCESS', 'ERROR');

CREATE TABLE "IntegrationLog" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "request" JSONB,
  "response" JSONB,
  "status" "IntegrationLogStatus" NOT NULL,
  "error" TEXT,
  "durationMs" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntegrationLog_provider_operation_createdAt_idx" ON "IntegrationLog"("provider", "operation", "createdAt");
CREATE INDEX "IntegrationLog_status_createdAt_idx" ON "IntegrationLog"("status", "createdAt");
