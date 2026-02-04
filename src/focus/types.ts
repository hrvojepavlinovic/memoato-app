export type Period = "day" | "week" | "month" | "year";

export type SeriesBucket = {
  label: string;
  total: number;
  startDate: string; // YYYY-MM-DD
};

export type CategoryChartType = "bar" | "line";

export type BucketAggregation = "sum" | "avg" | "last";
export type GoalDirection = "at_least" | "at_most" | "target";

export type CategoryWithStats = {
  id: string;
  title: string;
  slug: string;
  unit: string | null;
  chartType: CategoryChartType;
  categoryType: "NUMBER" | "DO" | "DONT" | "GOAL";
  accentHex: string;
  emoji: string | null;
  isSystem: boolean;
  sortOrder: number | null;
  bucketAggregation: BucketAggregation | null;
  goalDirection: GoalDirection | null;
  period: Period | null;
  goalWeekly: number | null;
  goalValue: number | null;
  thisWeekTotal: number;
  thisYearTotal: number;
  lastValue: number | null;
};

export type LinePoint = {
  label: string;
  startDate: string; // YYYY-MM-DD
  value: number | null;
};

export type CategoryEventItem = {
  id: string;
  amount: number | null;
  occurredAt: Date;
  occurredOn: Date;
  rawText: string | null;
  data: any | null;
};
