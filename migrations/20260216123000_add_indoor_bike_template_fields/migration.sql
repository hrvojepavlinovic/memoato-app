-- Add an Indoor Bike template with optional multi-dimensional fields.

INSERT INTO "CategoryTemplate" (
  "id",
  "key",
  "title",
  "categoryType",
  "chartType",
  "period",
  "unit",
  "bucketAggregation",
  "goalDirection",
  "goalWeekly",
  "goalValue",
  "accentHex",
  "emoji",
  "fieldsSchema",
  "createdAt",
  "updatedAt"
)
VALUES (
  'tmpl_indoor_bike',
  'indoor_bike',
  'Indoor bike',
  'NUMBER',
  'bar',
  'day',
  'kcal',
  'sum',
  'at_least',
  NULL,
  NULL,
  '#0A0A0A',
  '🚴',
  '[{"key":"km","label":"Distance","type":"number","unit":"km","placeholder":"12.4"},{"key":"minutes","label":"Duration","type":"number","unit":"min","placeholder":"41","storeAs":"duration"}]'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;

