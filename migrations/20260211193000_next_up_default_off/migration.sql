-- AlterTable
ALTER TABLE "User" ALTER COLUMN "nextUpEnabled" SET DEFAULT false;

-- Data migration
UPDATE "User" SET "nextUpEnabled" = false WHERE "nextUpEnabled" = true;

