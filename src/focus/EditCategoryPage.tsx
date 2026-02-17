import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteCategory, getCategories, updateCategory, useQuery } from "wasp/client/operations";
import { Button } from "../shared/components/Button";
import type { GoalDirection, Period, BucketAggregation, CategoryChartType } from "./types";
import { usePrivacy } from "../privacy/PrivacyProvider";
import { decryptCategoryTitle } from "../privacy/decryptors";
import { encryptUtf8ToEncryptedString, isEncryptedString } from "../privacy/crypto";
import { localDeleteCategory, localGetCategoriesWithStats, localUpdateCategory } from "./local";

type CategoryType = "NUMBER" | "DO" | "DONT";
type ChartType = CategoryChartType;
type BarAgg = Extract<BucketAggregation, "sum" | "avg">;
type LineAgg = Extract<BucketAggregation, "last" | "avg">;
type FieldType = "number" | "text";
type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  unit?: string | null;
  placeholder?: string | null;
  storeAs?: "duration" | null;
};

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

export function EditCategoryPage() {
  const navigate = useNavigate();
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const privacy = usePrivacy();
  const categoriesQuery = useQuery(getCategories, undefined, { enabled: privacy.mode !== "local" });
  const [localCategories, setLocalCategories] = useState<any[]>([]);

  const category = useMemo(() => {
    const list = privacy.mode === "local" ? localCategories : categoriesQuery.data ?? null;
    if (!categorySlug || !list) return null;
    return list.find((c: any) => c.slug === categorySlug) ?? list.find((c: any) => c.id === categorySlug) ?? null;
  }, [categoriesQuery.data, categorySlug, localCategories, privacy.mode]);

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
  const [rollupToActiveKcal, setRollupToActiveKcal] = useState<boolean>(false);
  const [fieldsSchema, setFieldsSchema] = useState<FieldDef[]>([]);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function defaultGoalDirectionForCategory(c: any): GoalDirection {
    const dir = (c?.goalDirection ?? "").toLowerCase();
    if (dir === "at_most") return "at_most";
    if (dir === "at_least") return "at_least";
    if (dir === "target") return "target";
    const slug = String(c?.slug ?? "").toLowerCase();
    if (slug === "weight") return "at_most";
    if (c?.categoryType === "DONT") return "at_most";
    return "at_least";
  }

  function normalizeHexInput(s: string): string | null {
    const m = /^#([0-9a-fA-F]{6})$/.exec(s.trim());
    if (!m) return null;
    return `#${m[1].toUpperCase()}`;
  }

  useEffect(() => {
    if (!category) return;
    setTitle(category.title ?? "");
    setCategoryType((category.categoryType === "GOAL" ? "NUMBER" : (category.categoryType as CategoryType)) ?? "NUMBER");
    setPeriod((category.period as Period) ?? "week");
    const nextChartType =
      (category.categoryType === "NUMBER" ? (category.chartType as ChartType) : "bar") ??
      ((category.categoryType === "GOAL" ? "line" : "bar") as ChartType);
    setChartType(nextChartType);
    const agg = (category.bucketAggregation ?? "").toLowerCase();
    if (nextChartType === "bar") {
      setBarAgg(agg === "avg" ? "avg" : "sum");
    } else {
      setLineAgg(agg === "avg" ? "avg" : "last");
    }
    setGoalDirection(defaultGoalDirectionForCategory(category));
    setUnit(category.unit && category.unit !== "x" ? category.unit : "");
    setGoal(category.goalWeekly != null ? String(category.goalWeekly) : "");
    setGoalValue(category.goalValue != null ? String(category.goalValue) : "");
    const hex = normalizeHexInput(category.accentHex ?? "#0A0A0A") ?? "#0A0A0A";
    setAccentHex(hex);
    setAccentHexInput(hex);
    setEmoji(category.emoji ?? "");
    setRollupToActiveKcal(category.rollupToActiveKcal === true);
    const rawSchema = (category as any).fieldsSchema;
    setFieldsSchema(Array.isArray(rawSchema) ? (rawSchema as FieldDef[]) : []);
  }, [category]);

  useEffect(() => {
    if (privacy.mode !== "local") return;
    if (!privacy.userId) return;
    localGetCategoriesWithStats(privacy.userId).then((cats) => setLocalCategories(cats as any));
  }, [privacy.mode, privacy.userId]);

  useEffect(() => {
    let cancelled = false;
    if (!category) return;
    if (!privacy.key) return;
    if (!isEncryptedString(category.title)) return;
    (async () => {
      const t = await decryptCategoryTitle(privacy.key as CryptoKey, category.title);
      if (cancelled) return;
      if (t) setTitle(t);
    })();
    return () => {
      cancelled = true;
    };
  }, [category, privacy.key]);

  const effectiveChartType: ChartType = categoryType === "NUMBER" ? chartType : "bar";
  const bucketAggregation: BucketAggregation = effectiveChartType === "bar" ? barAgg : lineAgg;
  const needsPeriod = effectiveChartType !== "line";
  const hint = useMemo(() => typeOptions.find((o) => o.value === categoryType)?.hint, [categoryType]);

  function onChartTypeChange(next: ChartType) {
    setChartType(next);
    if (next === "line") {
      if (goalValue.trim() === "" && goal.trim() !== "") {
        setGoalValue(goal);
        setGoal("");
      }
      return;
    }
    // bar
    if (goal.trim() === "" && goalValue.trim() !== "") {
      setGoal(goalValue);
      setGoalValue("");
    }
  }

  async function onSave() {
    if (!category?.id) return;

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
      const shouldEncrypt = privacy.mode === "encrypted" || isEncryptedString(category.title);
      let titleToStore = cleanTitle;
      if (shouldEncrypt) {
        if (!privacy.key || !privacy.cryptoParams) {
          window.alert("Unlock encryption from Profile → Privacy before editing encrypted categories.");
          return;
        }
        titleToStore = await encryptUtf8ToEncryptedString(privacy.key, privacy.cryptoParams, cleanTitle);
      }

      if (isEncryptedString(category.title) && !privacy.key) {
        window.alert("Unlock encryption from Profile → Privacy before editing encrypted categories.");
        return;
      }

      if (privacy.mode === "local") {
        if (!privacy.userId) return;
        await localUpdateCategory({
          userId: privacy.userId,
          categoryId: category.id,
          title: titleToStore,
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
          rollupToActiveKcal,
          fieldsSchema,
        });
        await localGetCategoriesWithStats(privacy.userId).then((cats) => setLocalCategories(cats as any));
        navigate(`/c/${category.slug ?? category.id}`);
      } else {
        const updated = await updateCategory({
          categoryId: category.id,
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
          rollupToActiveKcal,
          fieldsSchema,
        } as any);
        await categoriesQuery.refetch();
        navigate(`/c/${(updated as any).slug ?? updated.id}`);
      }
    } catch (e: any) {
      window.alert(e?.message ?? "Failed to update category.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onDelete() {
    if (!category?.id) return;
    if (!window.confirm("Delete this category and all its entries? This cannot be undone.")) return;

    try {
      if (privacy.mode === "local") {
        if (!privacy.userId) return;
        await localDeleteCategory({ userId: privacy.userId, categoryId: category.id });
        await localGetCategoriesWithStats(privacy.userId).then((cats) => setLocalCategories(cats as any));
        navigate("/");
      } else {
        await deleteCategory({ categoryId: category.id });
        await categoriesQuery.refetch();
        navigate("/");
      }
    } catch (e: any) {
      window.alert(e?.message ?? "Failed to delete category.");
    }
  }

  if (privacy.mode !== "local" && categoriesQuery.isLoading) {
    return <div className="mx-auto w-full max-w-screen-md px-4 py-6" />;
  }

  if (!category) {
    return (
      <div className="mx-auto w-full max-w-screen-md px-4 py-10">
        <div className="text-2xl font-semibold tracking-tight">404</div>
        <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Category not found.</div>
        <div className="mt-4">
          <Button onClick={() => navigate("/")}>Go home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-md px-4 py-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit category</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{hint}</p>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              onChange={(e) => onChartTypeChange(e.target.value as ChartType)}
              disabled={categoryType !== "NUMBER"}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:disabled:bg-neutral-900"
            >
              <option value="bar">Bar</option>
              <option value="line">Line</option>
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
              placeholder={effectiveChartType === "line" ? "e.g. kg" : "e.g. x"}
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
              placeholder={effectiveChartType === "line" ? "e.g. 85" : "e.g. 10"}
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
              <option value="at_least">At least</option>
              <option value="at_most">At most</option>
              <option value="target">Target</option>
            </select>
          </label>

          <div className="sm:col-span-2">
            <div className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Extra fields (optional)</div>
                  <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    Add dimensions like km or minutes. Only used when you fill them in.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFieldsOpen((v) => !v)}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                >
                  {fieldsOpen ? "Hide" : "Edit"}
                </button>
              </div>

              {fieldsOpen ? (
                <div className="mt-3 space-y-3">
                  {fieldsSchema.map((f, idx) => (
                    <div key={`${f.key}-${idx}`} className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                      <input
                        value={f.label}
                        onChange={(e) => {
                          const label = e.target.value;
                          setFieldsSchema((prev) => prev.map((x, i) => (i === idx ? { ...x, label } : x)));
                        }}
                        placeholder="Label"
                        className="sm:col-span-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                      />
                      <input
                        value={f.key}
                        onChange={(e) => {
                          const key = e.target.value;
                          setFieldsSchema((prev) => prev.map((x, i) => (i === idx ? { ...x, key } : x)));
                        }}
                        placeholder="key (e.g. km)"
                        className="sm:col-span-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                      />
                      <select
                        value={f.type}
                        onChange={(e) => {
                          const type = (e.target.value === "text" ? "text" : "number") as FieldType;
                          setFieldsSchema((prev) => prev.map((x, i) => (i === idx ? { ...x, type } : x)));
                        }}
                        className="sm:col-span-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                      >
                        <option value="number">Number</option>
                        <option value="text">Text</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setFieldsSchema((prev) => prev.filter((_, i) => i !== idx))}
                        className="sm:col-span-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900 dark:active:bg-neutral-800"
                      >
                        Remove
                      </button>

                      <input
                        value={f.unit ?? ""}
                        onChange={(e) => {
                          const unit = e.target.value;
                          setFieldsSchema((prev) => prev.map((x, i) => (i === idx ? { ...x, unit: unit.trim() || null } : x)));
                        }}
                        placeholder="Unit (optional)"
                        className="sm:col-span-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                      />
                      <input
                        value={f.placeholder ?? ""}
                        onChange={(e) => {
                          const placeholder = e.target.value;
                          setFieldsSchema((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, placeholder: placeholder.trim() || null } : x)),
                          );
                        }}
                        placeholder="Placeholder (optional)"
                        className="sm:col-span-3 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                      />
                      <label className="sm:col-span-1 flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
                        <input
                          type="checkbox"
                          checked={f.storeAs === "duration"}
                          onChange={(e) => {
                            const storeAs = e.target.checked ? ("duration" as const) : null;
                            setFieldsSchema((prev) => prev.map((x, i) => (i === idx ? { ...x, storeAs } : x)));
                          }}
                        />
                        Duration
                      </label>
                    </div>
                  ))}

                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={fieldsSchema.length >= 4}
                      onClick={() =>
                        setFieldsSchema((prev) => [
                          ...prev,
                          { key: "", label: "", type: "number", unit: null, placeholder: null, storeAs: null },
                        ])
                      }
                      className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100 active:bg-neutral-200 disabled:opacity-60 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                    >
                      Add field
                    </button>
                    <button
                      type="button"
                      onClick={() => setFieldsSchema([])}
                      className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-500 hover:bg-neutral-100 active:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {(category.slug ?? "").toLowerCase() !== "active-kcal" && (category.slug ?? "").toLowerCase() !== "notes" ? (
            <label className="sm:col-span-2 flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
              <div>
                <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Counts toward Active kcal</div>
                <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  When enabled, entries in this category can contribute to Active kcal, either via a kcal unit or a captured kcal field.
                </div>
              </div>
              <input
                type="checkbox"
                checked={rollupToActiveKcal}
                onChange={(e) => setRollupToActiveKcal(e.target.checked)}
                className="h-5 w-5"
              />
            </label>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {category.isSystem ? (
            <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400">This category can’t be deleted.</div>
          ) : (
            <Button
              variant="ghost"
              onClick={onDelete}
              className="border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-900/20"
            >
              Delete category
            </Button>
          )}
          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => navigate(`/c/${category.slug ?? category.id}`)}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={isSaving}>
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
