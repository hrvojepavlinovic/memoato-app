import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createCategory,
  ensureDefaultCategories,
  getCategories,
  getCategoryTemplates,
  useQuery,
} from "wasp/client/operations";
import { Button } from "../shared/components/Button";
import { usePrivacy } from "../privacy/PrivacyProvider";
import { encryptUtf8ToEncryptedString } from "../privacy/crypto";
import { localCreateCategory, localGetCategoriesWithStats, localListCategories } from "../focus/local";

type Template = {
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
};

const RECOMMENDED_KEYS = ["weight", "water", "push_ups"];

function titleKey(title: string): string {
  return title.trim().toLowerCase();
}

function normalizeAgg(v: string | null, chartType: Template["chartType"]): "sum" | "avg" | "last" {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "sum" || s === "avg" || s === "last") return s;
  return chartType === "line" ? "last" : "sum";
}

function normalizeDir(v: string | null, chartType: Template["chartType"]): "at_least" | "at_most" | "target" {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "at_least" || s === "at_most" || s === "target") return s;
  return chartType === "line" ? "at_most" : "at_least";
}

function fmtTemplateMeta(t: Template): string {
  const parts: string[] = [];
  if (t.chartType === "line") parts.push("Line");
  else parts.push(`Bar · ${t.period ?? "week"}`);

  if (t.unit && t.unit !== "x") parts.push(t.unit);

  if (t.chartType === "line") {
    if (t.goalValue != null) parts.push(`Goal ${t.goalValue}`);
  } else {
    if (t.goalWeekly != null) parts.push(`Goal ${t.goalWeekly}`);
  }
  return parts.join(" · ");
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const privacy = usePrivacy();

  const templatesQuery = useQuery(getCategoryTemplates);
  const templates = ((templatesQuery.data ?? []) as Template[]).filter((t) => titleKey(t.title) !== "notes");

  const categoriesQuery = useQuery(getCategories, undefined, { enabled: privacy.mode !== "local" });
  const [localHasNonSystem, setLocalHasNonSystem] = useState<boolean | null>(null);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (privacy.mode !== "local") return;
    if (!privacy.userId) return;
    let cancelled = false;
    (async () => {
      const cats = await localGetCategoriesWithStats(privacy.userId!);
      if (cancelled) return;
      setLocalHasNonSystem(cats.some((c) => !c.isSystem));
    })();
    return () => {
      cancelled = true;
    };
  }, [privacy.mode, privacy.userId]);

  const hasNonSystem = useMemo(() => {
    if (privacy.mode === "local") return localHasNonSystem === true;
    const cats = (categoriesQuery.data ?? []) as any[];
    return cats.some((c) => !(c as any).isSystem);
  }, [categoriesQuery.data, localHasNonSystem, privacy.mode]);

  useEffect(() => {
    if (!hasNonSystem) return;
    navigate("/", { replace: true });
  }, [hasNonSystem, navigate]);

  useEffect(() => {
    if (templates.length === 0) return;
    if (selectedKeys.size > 0) return;
    const next = new Set<string>();
    for (const k of RECOMMENDED_KEYS) {
      if (templates.some((t) => t.key === k)) next.add(k);
    }
    setSelectedKeys(next);
  }, [templates, selectedKeys.size]);

  useEffect(() => {
    // Notes are always included.
    if (privacy.mode === "local") {
      if (!privacy.userId) return;
      (async () => {
        const cats = await localListCategories(privacy.userId!);
        const hasNotes = cats.some((c) => (c.slug ?? "").toLowerCase() === "notes");
        if (hasNotes) return;
        await localCreateCategory({
          userId: privacy.userId!,
          title: "Notes",
          slug: "notes",
          isSystem: true,
          categoryType: "NUMBER",
          chartType: "bar",
          period: "day",
          unit: null,
          bucketAggregation: "sum",
          goalDirection: "at_least",
          goal: null,
          goalValue: null,
          accentHex: "#0A0A0A",
          emoji: "📝",
        });
      })();
      return;
    }

    ensureDefaultCategories().catch(() => {});
  }, [privacy.mode, privacy.userId]);

  const canCreateEncrypted = privacy.mode !== "encrypted" || (!!privacy.key && !!privacy.cryptoParams);

  async function onSkip() {
    try {
      localStorage.setItem("memoato:onboardingDone", "1");
    } catch {
      // ignore
    }
    navigate("/", { replace: true });
  }

  async function onCreateSelected() {
    if (isSaving) return;
    if (selectedKeys.size === 0) {
      await onSkip();
      return;
    }
    if (!canCreateEncrypted) {
      window.alert("Unlock encryption from Profile → Privacy before creating categories.");
      return;
    }

    setIsSaving(true);
    try {
      const selected = templates.filter((t) => selectedKeys.has(t.key));

      if (privacy.mode === "local") {
        if (!privacy.userId) return;
        const existing = await localListCategories(privacy.userId!);
        const existingTitles = new Set(existing.map((c) => titleKey(c.title)));
        for (const t of selected) {
          if (existingTitles.has(titleKey(t.title))) continue;
          const needsPeriod = t.chartType !== "line";
          await localCreateCategory({
            userId: privacy.userId!,
            title: t.title,
            categoryType: t.categoryType,
            chartType: t.chartType,
            period: needsPeriod ? (t.period ?? "week") : undefined,
            unit: t.unit,
            bucketAggregation: normalizeAgg(t.bucketAggregation, t.chartType),
            goalDirection: normalizeDir(t.goalDirection, t.chartType),
            goal: needsPeriod ? t.goalWeekly : null,
            goalValue: t.chartType === "line" ? t.goalValue : null,
            accentHex: t.accentHex,
            emoji: t.emoji,
          });
        }
      } else {
        const existing = (categoriesQuery.data ?? []) as any[];
        const existingTitles = new Set(existing.map((c) => titleKey(String((c as any).title ?? ""))));

        for (const t of selected) {
          if (existingTitles.has(titleKey(t.title))) continue;

          let titleToStore = t.title;
          if (privacy.mode === "encrypted") {
            titleToStore = await encryptUtf8ToEncryptedString(privacy.key!, privacy.cryptoParams!, t.title);
          }

          const needsPeriod = t.chartType !== "line";
          await createCategory({
            title: titleToStore,
            categoryType: t.categoryType,
            chartType: t.chartType,
            bucketAggregation: normalizeAgg(t.bucketAggregation, t.chartType),
            goalDirection: normalizeDir(t.goalDirection, t.chartType),
            period: needsPeriod ? (t.period ?? "week") : undefined,
            unit: t.unit ?? undefined,
            goal: needsPeriod ? (t.goalWeekly ?? undefined) : undefined,
            goalValue: t.chartType === "line" ? (t.goalValue ?? undefined) : undefined,
            accentHex: t.accentHex,
            emoji: t.emoji ?? undefined,
          } as any);
        }
      }

      try {
        localStorage.setItem("memoato:onboardingDone", "1");
      } catch {
        // ignore
      }
      navigate("/", { replace: true });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-screen-md px-4 py-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">Pick your trackers</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Select a few to start. Notes are included by default and can’t be deleted.
        </p>
      </div>

      {privacy.mode === "encrypted" && !canCreateEncrypted ? (
        <div className="card mb-4 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          Unlock encryption from Profile → Privacy before creating categories.
        </div>
      ) : null}

      <div className="card p-4">
        {templatesQuery.isLoading ? (
          <div className="text-sm text-neutral-500 dark:text-neutral-400">Loading templates…</div>
        ) : templates.length === 0 ? (
          <div className="text-sm text-neutral-500 dark:text-neutral-400">No templates available.</div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {templates.map((t) => {
              const checked = selectedKeys.has(t.key);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setSelectedKeys((prev) => {
                      const next = new Set(prev);
                      if (next.has(t.key)) next.delete(t.key);
                      else next.add(t.key);
                      return next;
                    });
                  }}
                  className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-3 text-left ${
                    checked
                      ? "border-neutral-950 bg-neutral-50 dark:border-white dark:bg-neutral-900"
                      : "border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900"
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className="flex h-9 w-9 flex-none items-center justify-center rounded-full border bg-white dark:bg-neutral-950"
                      style={{ borderColor: t.accentHex }}
                      aria-hidden="true"
                    >
                      <div className="text-lg leading-none">{t.emoji ?? ""}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-neutral-950 dark:text-neutral-100">{t.title}</div>
                      <div className="truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">{fmtTemplateMeta(t)}</div>
                    </div>
                  </div>
                  <div className="flex h-6 w-6 flex-none items-center justify-center">
                    <div
                      className={`h-5 w-5 rounded-md border ${
                        checked
                          ? "border-neutral-950 bg-neutral-950 dark:border-white dark:bg-white"
                          : "border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950"
                      }`}
                      aria-hidden="true"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onSkip} disabled={isSaving}>
            Skip
          </Button>
          <Button onClick={onCreateSelected} disabled={isSaving || templatesQuery.isLoading}>
            {isSaving ? "Creating…" : `Create selected (${selectedKeys.size})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
