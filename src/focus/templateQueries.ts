import { HttpError } from "wasp/server";
import { type GetCategoryTemplates } from "wasp/server/operations";

type CategoryTemplateItem = {
  key: string;
  title: string;
  categoryType: "NUMBER" | "DO" | "DONT";
  chartType: "bar" | "line";
  period: "day" | "week" | "month" | "year" | null;
  unit: string | null;
  bucketAggregation: string | null;
  goalDirection: string | null;
  goalWeekly: number | null;
  goalValue: number | null;
  accentHex: string;
  emoji: string | null;
  fieldsSchema:
    | Array<{
        key: string;
        label: string;
        type: "number" | "text";
        unit?: string | null;
        placeholder?: string | null;
        storeAs?: "duration" | null;
      }>
    | null;
};

function normalizeChartType(v: unknown): "bar" | "line" {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return s === "line" ? "line" : "bar";
}

function normalizePeriod(v: unknown): CategoryTemplateItem["period"] {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (s === "day" || s === "week" || s === "month" || s === "year") return s;
  return null;
}

function normalizeCategoryType(v: unknown): CategoryTemplateItem["categoryType"] {
  if (v === "DO" || v === "DONT" || v === "NUMBER") return v;
  return "NUMBER";
}

export const getCategoryTemplates: GetCategoryTemplates<void, CategoryTemplateItem[]> = async (
  _args,
  context,
) => {
  // App pages are authRequired anyway, but keep it strict.
  if (!context.user) throw new HttpError(401);

  const templates: any[] = await (context.entities.CategoryTemplate as any).findMany({
    select: {
      key: true,
      title: true,
      categoryType: true,
      chartType: true,
      period: true,
      unit: true,
      bucketAggregation: true,
      goalDirection: true,
      goalWeekly: true,
      goalValue: true,
      accentHex: true,
      emoji: true,
      fieldsSchema: true,
    },
    orderBy: [{ title: "asc" }],
  });

  return templates.map((t) => ({
    key: String(t.key),
    title: String(t.title),
    categoryType: normalizeCategoryType(t.categoryType),
    chartType: normalizeChartType(t.chartType),
    period: normalizePeriod(t.period),
    unit: typeof t.unit === "string" && t.unit.trim() ? t.unit.trim() : null,
    bucketAggregation:
      typeof t.bucketAggregation === "string" && t.bucketAggregation.trim()
        ? t.bucketAggregation.trim().toLowerCase()
        : null,
    goalDirection:
      typeof t.goalDirection === "string" && t.goalDirection.trim()
        ? t.goalDirection.trim().toLowerCase()
        : null,
    goalWeekly: typeof t.goalWeekly === "number" ? t.goalWeekly : null,
    goalValue: typeof t.goalValue === "number" ? t.goalValue : null,
    accentHex: typeof t.accentHex === "string" ? t.accentHex : "#0A0A0A",
    emoji: typeof t.emoji === "string" && t.emoji.trim() ? t.emoji.trim() : null,
    fieldsSchema: t.fieldsSchema ?? null,
  }));
};
