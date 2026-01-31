-- Add system category flag (e.g. non-deletable Notes category).
ALTER TABLE "Category" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

