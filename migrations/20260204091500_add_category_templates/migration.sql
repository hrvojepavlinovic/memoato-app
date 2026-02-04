-- CreateTable
CREATE TABLE "CategoryTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categoryType" "CategoryType" NOT NULL DEFAULT 'NUMBER',
    "chartType" TEXT,
    "period" TEXT,
    "unit" TEXT,
    "bucketAggregation" TEXT,
    "goalDirection" TEXT,
    "goalWeekly" DOUBLE PRECISION,
    "goalValue" DOUBLE PRECISION,
    "accentHex" TEXT NOT NULL DEFAULT '#0A0A0A',
    "emoji" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryTemplate_key_key" ON "CategoryTemplate"("key");

-- Seed defaults
INSERT INTO "CategoryTemplate" ("id","key","title","categoryType","chartType","period","unit","bucketAggregation","goalDirection","goalWeekly","goalValue","accentHex","emoji","createdAt","updatedAt")
VALUES
  ('tmpl_water','water','Water','NUMBER','bar','day','ml','sum','at_least',2000,NULL,'#0EA5E9','💧',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('tmpl_protein','protein','Protein','NUMBER','bar','day','g','sum','at_least',150,NULL,'#10B981','🥩',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

