-- Rename and extend CategoryTemplate defaults (idempotent).

-- Prefer "Water intake" wording in onboarding/templates.
UPDATE "CategoryTemplate"
SET "title" = 'Water intake'
WHERE "key" = 'water';

INSERT INTO "CategoryTemplate" ("id","key","title","categoryType","chartType","period","unit","bucketAggregation","goalDirection","goalWeekly","goalValue","accentHex","emoji","createdAt","updatedAt")
VALUES
  ('tmpl_active_kcal','active_kcal','Active kcal','NUMBER','bar','day','kcal','sum','at_least',500,NULL,'#0A0A0A','🔥',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tmpl_steps','steps','Steps','NUMBER','bar','day',NULL,'sum','at_least',10000,NULL,'#0A0A0A','👣',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

