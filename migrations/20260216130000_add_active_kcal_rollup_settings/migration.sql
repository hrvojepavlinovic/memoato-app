-- Add Active kcal rollup configuration (backwards compatible).

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "activeKcalRollupEnabled" boolean;

ALTER TABLE "Category"
ADD COLUMN IF NOT EXISTS "rollupToActiveKcal" boolean NOT NULL DEFAULT false;

-- Reasonable default: calorie categories roll up by default, except Active kcal itself.
UPDATE "Category"
SET "rollupToActiveKcal" = true
WHERE lower(coalesce("unit", '')) = 'kcal'
  AND lower(coalesce("slug", '')) <> 'active-kcal';

