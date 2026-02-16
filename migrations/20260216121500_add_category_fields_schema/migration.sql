-- Add optional field schemas for multi-dimensional logging.

ALTER TABLE "Category"
ADD COLUMN IF NOT EXISTS "fieldsSchema" jsonb;

ALTER TABLE "CategoryTemplate"
ADD COLUMN IF NOT EXISTS "fieldsSchema" jsonb;

