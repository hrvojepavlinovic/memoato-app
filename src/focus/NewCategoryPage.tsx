import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCategory } from "wasp/client/operations";
import { Button } from "../shared/components/Button";
import type { Period } from "./types";
import { usePrivacy } from "../privacy/PrivacyProvider";
import { encryptUtf8ToEncryptedString } from "../privacy/crypto";
import { localCreateCategory } from "./local";

type CategoryType = "NUMBER" | "DO" | "DONT" | "GOAL";

const typeOptions: { value: CategoryType; label: string; hint: string }[] = [
  { value: "NUMBER", label: "Track number", hint: "Counts, minutes, kcal, etc." },
  { value: "DO", label: "Do's", hint: "Count each time you do it." },
  { value: "DONT", label: "Don'ts", hint: "Count each time you break it." },
  { value: "GOAL", label: "Goal value", hint: "Track a value over time (line chart)." },
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
  const [title, setTitle] = useState("");
  const [categoryType, setCategoryType] = useState<CategoryType>("NUMBER");
  const [period, setPeriod] = useState<Period>("week");
  const [unit, setUnit] = useState("");
  const [goal, setGoal] = useState<string>("");
  const [goalValue, setGoalValue] = useState<string>("");
  const [accentHex, setAccentHex] = useState("#0A0A0A");
  const [accentHexInput, setAccentHexInput] = useState("#0A0A0A");
  const [emoji, setEmoji] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const needsPeriod = categoryType !== "GOAL";
  const hint = useMemo(() => typeOptions.find((o) => o.value === categoryType)?.hint, [categoryType]);

  function normalizeHexInput(s: string): string | null {
    const m = /^#([0-9a-fA-F]{6})$/.exec(s.trim());
    if (!m) return null;
    return `#${m[1].toUpperCase()}`;
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
          period: needsPeriod ? period : undefined,
          unit: unit.trim() || null,
          goal: g ?? null,
          goalValue: gv ?? null,
          accentHex: cleanHex,
          emoji: emoji.trim() || null,
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
        period: needsPeriod ? period : undefined,
        unit: unit.trim() || undefined,
        goal: g ?? undefined,
        goalValue: gv ?? undefined,
        accentHex: cleanHex,
        emoji: emoji.trim() || undefined,
      });
      navigate(`/c/${(created as any).slug ?? created.id}`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-screen-md px-4 py-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">New category</h2>
        <p className="text-sm text-neutral-500">{hint}</p>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="label">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Meditation"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="label">Type</span>
            <select
              value={categoryType}
              onChange={(e) => setCategoryType(e.target.value as CategoryType)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
            >
              {typeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="label">Period</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              disabled={!needsPeriod}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-100"
            >
              {periodOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

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
                className="h-10 w-12 rounded-md border border-neutral-300 bg-white p-1"
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
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-500"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="label">Emoji (optional)</span>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="e.g. 🧘"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="label">Unit (optional)</span>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder={categoryType === "GOAL" ? "e.g. kg" : "e.g. x"}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="label">
              {categoryType === "GOAL" ? "Goal value (optional)" : "Goal (optional)"}
            </span>
            <input
              type="number"
              step="0.1"
              value={categoryType === "GOAL" ? goalValue : goal}
              onChange={(e) => (categoryType === "GOAL" ? setGoalValue(e.target.value) : setGoal(e.target.value))}
              placeholder={categoryType === "GOAL" ? "e.g. 85" : "e.g. 10"}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-500"
            />
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
