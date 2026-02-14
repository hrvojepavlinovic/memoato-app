ALTER TABLE "User" ADD COLUMN "publicStatsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "publicStatsToken" TEXT;
ALTER TABLE "User" ADD COLUMN "publicStatsCategoryIds" JSONB;
CREATE UNIQUE INDEX "User_publicStatsToken_key" ON "User"("publicStatsToken");
