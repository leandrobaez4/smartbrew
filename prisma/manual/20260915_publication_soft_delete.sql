-- Apply before deploying the new publication flow. Preserves all existing rows.
ALTER TABLE "Publication" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
-- Only a confirmed removal may set deletedAt. Ambiguous Meta errors must not.
