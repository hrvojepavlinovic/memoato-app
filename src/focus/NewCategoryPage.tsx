import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCategory } from "wasp/client/operations";
import { Button } from "../shared/components/Button";
import type { GoalDirection, Period } from "./types";
import { usePrivacy } from "../privacy/PrivacyProvider";
import { encryptUtf8ToEncryptedString } from "../privacy/crypto";
import { localCreateCategory } from "./local";

type CategoryType = "NUMBER" | "DO" | "DONT";
type ChartType = "bar" | "line";
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

export function NewCategoryPage() {
  const navigate = useNavigate();
  const privacy = usePrivacy();
  const [template, setTemplate] = useState<"custom" | "water" | "protein">("custom");
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
  const [isSaving, setIsSaving] = useState(false);

  const effectiveChartType: ChartType =
    categoryType === "NUMBER" ? chartType : "bar";
  const bucketAggregation =
    effectiveChartType === "bar" ? barAgg : lineAgg;
  const needsPeriod = effectiveChartType !== "line";
  const hint = useMemo(() => typeOptions.find((o) => o.value === categoryType)?.hint, [categoryType]);

  function normalizeHexInput(s: string): string | null {
    const m = /^#([0-9a-fA-F]{6})$/.exec(s.trim());
    if (!m) return null;
    return `#${m[1].toUpperCase()}`;
  }

  function applyTemplate(next: "custom" | "water" | "protein") {
    setTemplate(next);
    if (next === "custom") return;

    setCategoryType("NUMBER");
    setChartType("bar");
    setBarAgg("sum");
    setGoalDirection("at_least");

    if (next === "water") {
      setTitle("Water");
      setPeriod("day");
      setUnit("ml");
      setGoal("2000");
      setGoalValue("");
      setEmoji("💧");
      const hex = "#0EA5E9";
      setAccentHex(hex);
      setAccentHexInput(hex);
      return;
    }

    setTitle("Protein");
    setPeriod("day");
    setUnit("g");
    setGoal("150");
    setGoalValue("");
    setEmoji("🥩");
    const hex = "#10B981";
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
            <select
              value={template}
              onChange={(e) => applyTemplate(e.target.value as any)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            >
              <option value="custom">Custom</option>
              <option value="water">Water intake</option>
              <option value="protein">Protein</option>
            </select>
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
            <select
              value={categoryType}
              onChange={(e) => setCategoryType(e.target.value as CategoryType)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            >
              {typeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="label">Chart</span>
            <select
              value={effectiveChartType}
              onChange={(e) => setChartType(e.target.value as ChartType)}
              disabled={categoryType !== "NUMBER"}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:disabled:bg-neutral-900"
            >
              <option value="bar">Bar (totals)</option>
              <option value="line">Line (values)</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="label">Period</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              disabled={!needsPeriod}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:disabled:bg-neutral-900"
            >
              {periodOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {categoryType === "NUMBER" ? (
            <label className="flex flex-col gap-1">
              <span className="label">Multiple entries</span>
              {effectiveChartType === "bar" ? (
                <select
                  value={barAgg}
                  onChange={(e) => setBarAgg(e.target.value as BarAgg)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                >
                  <option value="sum">Total (sum)</option>
                  <option value="avg">Average</option>
                </select>
              ) : (
                <select
                  value={lineAgg}
                  onChange={(e) => setLineAgg(e.target.value as LineAgg)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                >
                  <option value="last">Latest</option>
                  <option value="avg">Average</option>
                </select>
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
            <select
              value={goalDirection}
              onChange={(e) => setGoalDirection(e.target.value as GoalDirection)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            >
              <option value="at_least">At least (higher is better)</option>
              <option value="at_most">At most (lower is better)</option>
              <option value="target">Target (hit the value)</option>
            </select>
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
