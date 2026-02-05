-- Seed more CategoryTemplate defaults (idempotent).
INSERT INTO "CategoryTemplate" ("id","key","title","categoryType","chartType","period","unit","bucketAggregation","goalDirection","goalWeekly","goalValue","accentHex","emoji","createdAt","updatedAt")
VALUES
  ('tmpl_weight','weight','Weight','NUMBER','line',NULL,'kg','last','at_most',NULL,85,'#0EA5E9','⚖️',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tmpl_push_ups','push_ups','Push ups','NUMBER','bar','week',NULL,'sum','at_least',300,NULL,'#F59E0B','💪',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

