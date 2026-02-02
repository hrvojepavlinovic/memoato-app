-- Goal improvements:
-- - bucketAggregation controls how multiple entries are combined per chart bucket: sum | avg | last
-- - goalDirection controls "at least" vs "at most" goals: at_least | at_most
ALTER TABLE "Category" ADD COLUMN "bucketAggregation" TEXT;
ALTER TABLE "Category" ADD COLUMN "goalDirection" TEXT;

-- Legacy: migrate deprecated GOAL categoryType to NUMBER (chartType already tracks line vs bar).
UPDATE "Category"
SET "categoryType" = 'NUMBER'
WHERE "categoryType" = 'GOAL';

