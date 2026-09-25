ALTER TABLE "JobExecution"
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "JobExecution_status_jobName_startedAt_idx" ON "JobExecution"("status", "jobName", "startedAt");
