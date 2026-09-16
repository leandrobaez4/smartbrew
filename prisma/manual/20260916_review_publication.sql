CREATE TABLE IF NOT EXISTS "ReviewPublication" (
  "memberId" TEXT NOT NULL PRIMARY KEY,
  "instagramId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "containerId" TEXT,
  "mediaId" TEXT,
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
