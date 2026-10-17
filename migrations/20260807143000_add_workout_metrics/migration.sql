-- Additive only. Event remains the parent workout/session and raw NOTE entries
-- remain immutable evidence. Apply only after a reviewed production preview.
CREATE TABLE "WorkoutMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workoutEventId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'dimension',
    "rollupTarget" TEXT,
    "excludedFromDailyActiveKcal" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkoutMetric_workoutEventId_key_key"
ON "WorkoutMetric"("workoutEventId", "key");

CREATE INDEX "WorkoutMetric_userId_key_idx"
ON "WorkoutMetric"("userId", "key");

CREATE INDEX "WorkoutMetric_workoutEventId_idx"
ON "WorkoutMetric"("workoutEventId");

ALTER TABLE "WorkoutMetric"
ADD CONSTRAINT "WorkoutMetric_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkoutMetric"
ADD CONSTRAINT "WorkoutMetric_workoutEventId_fkey"
FOREIGN KEY ("workoutEventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
