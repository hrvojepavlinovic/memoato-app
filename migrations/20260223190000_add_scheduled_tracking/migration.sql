ALTER TABLE "Category"
ADD COLUMN "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "scheduleType" TEXT,
ADD COLUMN "scheduleDays" JSONB,
ADD COLUMN "scheduleTime" TEXT;

UPDATE "Category"
SET "categoryType" = 'DO'::"CategoryType"
WHERE "sourceArchivedAt" IS NULL
  AND LOWER(TRIM(COALESCE("title", ''))) IN ('football', 'padel');

UPDATE "CategoryTemplate"
SET "categoryType" = 'DO'::"CategoryType"
WHERE LOWER(TRIM(COALESCE("title", ''))) IN ('football', 'padel');
