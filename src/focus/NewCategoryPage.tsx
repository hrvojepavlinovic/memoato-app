import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCategory, getCategoryTemplates, useQuery } from "wasp/client/operations";
import { Button } from "../shared/components/Button";
import type { CategoryChartType, GoalDirection, Period } from "./types";
import { usePrivacy } from "../privacy/PrivacyProvider";
import { encryptUtf8ToEncryptedString } from "../privacy/crypto";
import { localCreateCategory } from "./local";

type CategoryType = "NUMBER" | "DO" | "DONT";
type ChartType = CategoryChartType;
type BarAgg = "sum" | "avg";
type LineAgg = "last" | "avg";

const typeOptions: { value: CategoryType; label: string; hint: string }[] = [
  { value: "NUMBER", label: "Track number", hint: "Counts, minutes, kcal, etc." },
  { value: "DO", label: "Do's", hint: "Count each time you do it." },
  { value: "DONT", label: "Don'ts", hint: "Count each time you break it." },
];

const periodOptions: { value: Period; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

type CategoryTemplateItem = {
  key: string;
  title: string;
  categoryType: CategoryType;
  chartType: ChartType;
  period: Period | null;
  unit: string | null;
  bucketAggregation: string | null;
  goalDirection: string | null;
  goalWeekly: number | null;
  goalValue: number | null;
  accentHex: string;
  emoji: string | null;
  fieldsSchema?: any | null;
  scheduleEnabled?: boolean | null;
  scheduleType?: "daily" | "weekly" | null;
  scheduleDays?: number[] | null;
  scheduleTime?: string | null;
};

const weekdayOptions: Array<{ value: number; label: string }> = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

function SelectChevron({ disabled }: { disabled?: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute inset-y-0 right-3 flex items-center ${
        disabled ? "text-neutral-400 dark:text-neutral-500" : "text-neutral-500 dark:text-neutral-400"
      }`}
      aria-hidden="true"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

function defaultViewForType(categoryType: CategoryType): ChartType {
  if (categoryType === "DO" || categoryType === "DONT") return "dot";
  return "bar";
}

export function NewCategoryPage() {
  const navigate = useNavigate();
  const privacy = usePrivacy();
  const templatesQuery = useQuery(getCategoryTemplates);
  const templates = (templatesQuery.data ?? []) as CategoryTemplateItem[];
  const [templateKey, setTemplateKey] = useState<string>("custom");
  const [title, setTitle] = useState("");
  const [categoryType, setCategoryType] = useState<CategoryType>("NUMBER");
  const [period, setPeriod] = useState<Period>("week");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [barAgg, setBarAgg] = useState<BarAgg>("sum");
  const [lineAgg, setLineAgg] = useState<LineAgg>("last");
  const [unit, setUnit] = useState("");
  const [goal, setGoal] = useState<string>("");
  const [goalValue, setGoalValue] = useState<string>("");
  const [goalDirection, setGoalDirection] = useState<GoalDirection>("at_least");
  const [accentHex, setAccentHex] = useState("#0A0A0A");
  const [accentHexInput, setAccentHexInput] = useState("#0A0A0A");
  const [emoji, setEmoji] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleType, setScheduleType] = useState<"daily" | "weekly">("weekly");
  const [scheduleDays, setScheduleDays] = useState<number[]>([new Date().getDay()]);
  const [scheduleTime, setScheduleTime] = useState("");
  const [fieldsSchema, setFieldsSchema] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const effectiveChartType: ChartType =
    categoryType === "NUMBER" ? chartType : defaultViewForType(categoryType);
  const bucketAggregation =
    effectiveChartType === "line" ? lineAgg : barAgg;
  const needsPeriod = effectiveChartType !== "line";
  const hint = useMemo(() => typeOptions.find((o) => o.value === categoryType)?.hint, [categoryType]);
  const canSchedule = categoryType === "DO" || categoryType === "DONT";

  function toggleScheduleDay(day: number) {
    setScheduleDays((prev) => {
      const exists = prev.includes(day);
      if (exists) {
        if (prev.length <= 1) return prev;
        return prev.filter((d) => d !== day);
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  }

  function normalizeHexInput(s: string): string | null {
    const m = /^#([0-9a-fA-F]{6})$/.exec(s.trim());
    if (!m) return null;
    return `#${m[1].toUpperCase()}`;
  }

  function applyTemplateByKey(nextKey: string) {
    setTemplateKey(nextKey);
    if (nextKey === "custom") {
      setFieldsSchema(null);
      return;
    }
    const t = templates.find((x) => x.key === nextKey);
    if (!t) return;

    setTitle(t.title);
    setCategoryType(t.categoryType);
    setChartType(t.chartType);
    setFieldsSchema(t.fieldsSchema ?? null);
    if (t.chartType !== "line") {
      setPeriod(t.period ?? "week");
      const agg = (t.bucketAggregation ?? "").toLowerCase();
      setBarAgg(agg === "avg" ? "avg" : "sum");
      setGoal(String(t.goalWeekly ?? ""));
      setGoalValue("");
    } else {
      setLineAgg(((t.bucketAggregation ?? "").toLowerCase() === "avg" ? "avg" : "last") as LineAgg);
      setGoal("");
      setGoalValue(String(t.goalValue ?? ""));
    }
    const dir = (t.goalDirection ?? "").toLowerCase() as GoalDirection;
    setGoalDirection(dir === "at_most" || dir === "target" ? dir : "at_least");
    setUnit(t.unit ?? "");
    setEmoji(t.emoji ?? "");
    setScheduleEnabled(t.scheduleEnabled === true);
    setScheduleType(t.scheduleType === "daily" ? "daily" : "weekly");
    setScheduleDays(
      Array.isArray(t.scheduleDays) && t.scheduleDays.length > 0
        ? Array.from(new Set(t.scheduleDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort(
            (a, b) => a - b,
          )
        : [new Date().getDay()],
    );
    setScheduleTime(typeof t.scheduleTime === "string" ? t.scheduleTime : "");
    const hex = normalizeHexInput(t.accentHex) ?? "#0A0A0A";
    setAccentHex(hex);
    setAccentHexInput(hex);
  }

  async function onCreate() {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      window.alert("Title is required.");
      return;
    }

    const cleanHex = normalizeHexInput(accentHexInput);
    if (!cleanHex) {
      window.alert("Accent color must be a hex color like #12AB34.");
      return;
    }

    const g = goal.trim() === "" ? null : Number(goal);
    if (goal.trim() !== "" && !Number.isFinite(g)) {
      window.alert("Goal must be a number.");
      return;
    }

    const gv = goalValue.trim() === "" ? null : Number(goalValue);
    if (goalValue.trim() !== "" && !Number.isFinite(gv)) {
      window.alert("Goal value must be a number.");
      return;
    }
    if (canSchedule && scheduleEnabled && scheduleType === "weekly" && scheduleDays.length === 0) {
      window.alert("Pick at least one day.");
      return;
    }
    if (canSchedule && scheduleEnabled && scheduleTime.trim() !== "" && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(scheduleTime.trim())) {
      window.alert("Time must be in HH:mm format.");
      return;
    }

    setIsSaving(true);
    try {
      if (privacy.mode === "local") {
        if (!privacy.userId) return;
        const created = await localCreateCategory({
          userId: privacy.userId,
          title: cleanTitle,
          categoryType,
          chartType: effectiveChartType,
          period: needsPeriod ? period : undefined,
          unit: unit.trim() || null,
          goal: needsPeriod ? (g ?? null) : null,
          goalValue: effectiveChartType === "line" ? (gv ?? null) : null,
          accentHex: cleanHex,
          emoji: emoji.trim() || null,
          bucketAggregation,
          goalDirection,
          fieldsSchema,
          scheduleEnabled: canSchedule ? scheduleEnabled : false,
          scheduleType: canSchedule && scheduleEnabled ? scheduleType : null,
          scheduleDays: canSchedule && scheduleEnabled && scheduleType === "weekly" ? scheduleDays : null,
          scheduleTime: canSchedule && scheduleEnabled && scheduleTime.trim() ? scheduleTime.trim() : null,
        });
        navigate(`/c/${created.slug ?? created.id}`);
        return;
      }

      let titleToStore = cleanTitle;
      if (privacy.mode === "encrypted") {
        if (!privacy.key || !privacy.cryptoParams) {
          window.alert("Unlock encryption from Profile → Privacy before creating categories.");
          return;
        }
        titleToStore = await encryptUtf8ToEncryptedString(privacy.key, privacy.cryptoParams, cleanTitle);
      }

      const created = await createCategory({
        title: titleToStore,
        categoryType,
        chartType: effectiveChartType,
        bucketAggregation,
        goalDirection,
        period: needsPeriod ? period : undefined,
        unit: unit.trim() || undefined,
        goal: needsPeriod ? (g ?? undefined) : undefined,
        goalValue: effectiveChartType === "line" ? (gv ?? undefined) : undefined,
        accentHex: cleanHex,
        emoji: emoji.trim() || undefined,
        fieldsSchema: fieldsSchema ?? undefined,
        scheduleEnabled: canSchedule ? scheduleEnabled : false,
        scheduleType: canSchedule && scheduleEnabled ? scheduleType : null,
        scheduleDays: canSchedule && scheduleEnabled && scheduleType === "weekly" ? scheduleDays : undefined,
        scheduleTime: canSchedule && scheduleEnabled && scheduleTime.trim() ? scheduleTime.trim() : undefined,
      } as any);
      navigate(`/c/${(created as any).slug ?? created.id}`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-screen-md px-4 py-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">New category</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{hint}</p>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="label">Template</span>
            <div className="relative">
              <select
                value={templateKey}
                onChange={(e) => applyTemplateByKey(e.target.value)}
                className="w-full appearance-none rounded-lg border border-neutral-300 bg-white py-2 pl-3 pr-10 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              >
                <option value="custom">Custom</option>
                {templates.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.title}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="label">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Meditation"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="label">Type</span>
            <div className="relative">
              <select
                value={categoryType}
                onChange={(e) => {
                  const nextType = e.target.value as CategoryType;
                  setCategoryType(nextType);
                  if (nextType !== "NUMBER") {
                    setChartType(defaultViewForType(nextType));
                  } else {
                    setChartType((prev) => (prev === "dot" ? "bar" : prev));
                  }
                }}
                className="w-full appearance-none rounded-lg border border-neutral-300 bg-white py-2 pl-3 pr-10 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              >
                {typeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="label">Default view</span>
            <div className="relative">
              <select
                value={effectiveChartType}
                onChange={(e) => setChartType(e.target.value as ChartType)}
                disabled={categoryType !== "NUMBER"}
                className="w-full appearance-none rounded-lg border border-neutral-300 bg-white py-2 pl-3 pr-10 text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:disabled:bg-neutral-900"
              >
                <option value="bar">Bar</option>
                <option value="line">Line</option>
                <option value="dot">Dots</option>
              </select>
              <SelectChevron disabled={categoryType !== "NUMBER"} />
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="label">Period</span>
            <div className="relative">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as Period)}
                disabled={!needsPeriod}
                className="w-full appearance-none rounded-lg border border-neutral-300 bg-white py-2 pl-3 pr-10 text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:disabled:bg-neutral-900"
              >
                {periodOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <SelectChevron disabled={!needsPeriod} />
            </div>
          </label>

          {canSchedule ? (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/30 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Schedule (optional)</div>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                  />
                  Enable
                </label>
              </div>
              {scheduleEnabled ? (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="label">Frequency</span>
                    <div className="relative">
                      <select
                        value={scheduleType}
                        onChange={(e) => setScheduleType(e.target.value as "daily" | "weekly")}
                        className="w-full appearance-none rounded-lg border border-neutral-300 bg-white py-2 pl-3 pr-10 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="daily">Daily</option>
                      </select>
                      <SelectChevron />
                    </div>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="label">Time (optional)</span>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                    />
                  </label>
                  {scheduleType === "weekly" ? (
                    <div className="sm:col-span-2">
                      <span className="label">Days</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {weekdayOptions.map((day) => {
                          const active = scheduleDays.includes(day.value);
                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => toggleScheduleDay(day.value)}
                              className={
                                "rounded-full border px-3 py-1.5 text-xs font-semibold " +
                                (active
                                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950"
                                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800")
                              }
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {categoryType === "NUMBER" ? (
            <label className="flex flex-col gap-1">
              <span className="label">Multiple entries</span>
              {effectiveChartType !== "line" ? (
                <div className="relative">
                  <select
                    value={barAgg}
                    onChange={(e) => setBarAgg(e.target.value as BarAgg)}
                    className="w-full appearance-none rounded-lg border border-neutral-300 bg-white py-2 pl-3 pr-10 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  >
                    <option value="sum">Total (sum)</option>
                    <option value="avg">Average</option>
                  </select>
                  <SelectChevron />
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={lineAgg}
                    onChange={(e) => setLineAgg(e.target.value as LineAgg)}
                    className="w-full appearance-none rounded-lg border border-neutral-300 bg-white py-2 pl-3 pr-10 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  >
                    <option value="last">Latest</option>
                    <option value="avg">Average</option>
                  </select>
                  <SelectChevron />
                </div>
              )}
            </label>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="label">Accent</span>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accentHex}
                onChange={(e) => {
                  const n = normalizeHexInput(e.target.value) ?? "#0A0A0A";
                  setAccentHex(n);
                  setAccentHexInput(n);
                }}
                className="h-10 w-12 rounded-md border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-950"
              />
              <input
                value={accentHexInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setAccentHexInput(v);
                  const n = normalizeHexInput(v);
                  if (n) setAccentHex(n);
                }}
                onBlur={() => {
                  const n = normalizeHexInput(accentHexInput);
                  if (n) setAccentHexInput(n);
                }}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="label">Emoji (optional)</span>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="e.g. 🧘"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="label">Unit (optional)</span>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder={effectiveChartType === "line" ? "e.g. kg" : "e.g. ml"}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="label">
              {effectiveChartType === "line" ? "Goal value (optional)" : "Goal (optional)"}
            </span>
            <input
              type="number"
              step="0.1"
              value={effectiveChartType === "line" ? goalValue : goal}
              onChange={(e) =>
                effectiveChartType === "line" ? setGoalValue(e.target.value) : setGoal(e.target.value)
              }
              placeholder={effectiveChartType === "line" ? "e.g. 85" : "e.g. 2000"}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="label">Goal direction</span>
            <div className="relative">
              <select
                value={goalDirection}
                onChange={(e) => setGoalDirection(e.target.value as GoalDirection)}
                className="w-full appearance-none rounded-lg border border-neutral-300 bg-white py-2 pl-3 pr-10 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              >
                <option value="at_least">At least (higher is better)</option>
                <option value="at_most">At most (lower is better)</option>
                <option value="target">Target (hit the value)</option>
              </select>
              <SelectChevron />
            </div>
          </label>
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={() => navigate("/")}>
            Cancel
          </Button>
          <Button onClick={onCreate} disabled={isSaving}>
            {isSaving ? "Creating…" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
