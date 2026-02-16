-- Remove Indoor bike template (keep any user-created categories intact).

DELETE FROM "CategoryTemplate"
WHERE "key" = 'indoor_bike';

