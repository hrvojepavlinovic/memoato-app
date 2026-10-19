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
import { AppIcon } from "../shared/components/AppIcon";
import { completeOnboarding } from "./progress";
import { usePrivacy } from "../privacy/PrivacyProvider";
import { encryptUtf8ToEncryptedString } from "../privacy/crypto";
import { localCreateCategory, localListCategories } from "../focus/local";

type Template = {
  key: string;
  title: string;
  categoryType: "NUMBER" | "DO" | "DONT";
  chartType: "bar" | "line" | "dot";
  period: "day" | "week" | "month" | "year" | null;
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

const RECOMMENDED_KEYS = ["weight", "active_kcal", "steps", "water"];

function titleKey(title: string): string {
  return title.trim().toLowerCase();
}

function normalizeAgg(
  v: string | null,
  chartType: Template["chartType"],
): "sum" | "avg" | "last" {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "sum" || s === "avg" || s === "last") return s;
  return chartType === "line" ? "last" : "sum";
}

function normalizeDir(
  v: string | null,
  chartType: Template["chartType"],
): "at_least" | "at_most" | "target" {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "at_least" || s === "at_most" || s === "target") return s;
  return chartType === "line" ? "at_most" : "at_least";
}

function fmtTemplateMeta(t: Template): string {
  const parts: string[] = [];
  if (t.unit && t.unit !== "x") parts.push(t.unit);
  if (t.chartType !== "line" && t.period) parts.push(`Per ${t.period}`);
  return parts.join(" · ");
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const privacy = usePrivacy();

  const templatesQuery = useQuery(getCategoryTemplates);
  const templates = useMemo(() => {
    const raw = ((templatesQuery.data ?? []) as Template[]).filter(
      (t) => titleKey(t.title) !== "notes",
    );
    const rankByKey = new Map<string, number>();
    for (let i = 0; i < RECOMMENDED_KEYS.length; i++) {
      rankByKey.set(RECOMMENDED_KEYS[i]!, i);
    }
    return raw.slice().sort((a, b) => {
      const ra = rankByKey.get(a.key) ?? Number.POSITIVE_INFINITY;
      const rb = rankByKey.get(b.key) ?? Number.POSITIVE_INFINITY;
      if (ra !== rb) return ra - rb;
      return a.title.localeCompare(b.title);
    });
  }, [templatesQuery.data]);

  const categoriesQuery = useQuery(getCategories, undefined, {
    enabled: privacy.mode !== "local",
  });

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Notes are always included.
    if (privacy.mode === "local") {
      if (!privacy.userId) return;
      (async () => {
        const cats = await localListCategories(privacy.userId!);
        const hasNotes = cats.some(
          (c) => (c.slug ?? "").toLowerCase() === "notes",
        );
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
      })().catch(() =>
        setError(
          "Couldn’t prepare local notes. Try reloading before adding views.",
        ),
      );
      return;
    }

    ensureDefaultCategories().catch(() => {});
  }, [privacy.mode, privacy.userId]);

  const canCreateEncrypted =
    privacy.mode !== "encrypted" || (!!privacy.key && !!privacy.cryptoParams);

  function start(destination = "/") {
    completeOnboarding();
    navigate(destination, { replace: true });
  }

  async function onCreateSelected() {
    if (isSaving) return;
    if (selectedKeys.size === 0) {
      start();
      return;
    }
    if (privacy.mode !== "local" && !categoriesQuery.data) {
      setError(
        "Your existing views haven’t loaded yet. Try reloading before adding more, or start with a note above.",
      );
      return;
    }
    if (!canCreateEncrypted) {
      setError("Unlock encryption from Profile → Privacy before adding views.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const selected = templates.filter((t) => selectedKeys.has(t.key));

      if (privacy.mode === "local") {
        if (!privacy.userId) throw new Error("Missing local user");
        const existing = await localListCategories(privacy.userId!);
        const existingTitles = new Set(existing.map((c) => titleKey(c.title)));
        for (const t of selected) {
          if (existingTitles.has(titleKey(t.title))) continue;
          const chartType = t.chartType === "line" ? "line" : "bar";
          const needsPeriod = chartType !== "line";
          await localCreateCategory({
            userId: privacy.userId!,
            title: t.title,
            categoryType: t.categoryType,
            chartType,
            period: needsPeriod ? (t.period ?? "week") : undefined,
            unit: t.unit,
            bucketAggregation: normalizeAgg(t.bucketAggregation, chartType),
            goalDirection: normalizeDir(t.goalDirection, chartType),
            goal: needsPeriod ? t.goalWeekly : null,
            goalValue: chartType === "line" ? t.goalValue : null,
            accentHex: t.accentHex,
            emoji: t.emoji,
            fieldsSchema: t.fieldsSchema ?? null,
            scheduleEnabled: t.scheduleEnabled === true,
            scheduleType: t.scheduleType ?? null,
            scheduleDays: t.scheduleDays ?? null,
            scheduleTime: t.scheduleTime ?? null,
          });
        }
      } else {
        const existing = (categoriesQuery.data ?? []) as any[];
        const existingTitles = new Set(
          existing.map((c) => titleKey(String((c as any).title ?? ""))),
        );

        for (const t of selected) {
          if (existingTitles.has(titleKey(t.title))) continue;

          let titleToStore = t.title;
          if (privacy.mode === "encrypted") {
            titleToStore = await encryptUtf8ToEncryptedString(
              privacy.key!,
              privacy.cryptoParams!,
              t.title,
            );
          }

          const chartType = t.chartType === "line" ? "line" : "bar";
          const needsPeriod = chartType !== "line";
          await createCategory({
            title: titleToStore,
            categoryType: t.categoryType,
            chartType,
            bucketAggregation: normalizeAgg(t.bucketAggregation, chartType),
            goalDirection: normalizeDir(t.goalDirection, chartType),
            period: needsPeriod ? (t.period ?? "week") : undefined,
            unit: t.unit ?? undefined,
            goal: needsPeriod ? (t.goalWeekly ?? undefined) : undefined,
            goalValue:
              chartType === "line" ? (t.goalValue ?? undefined) : undefined,
            accentHex: t.accentHex,
            emoji: t.emoji ?? undefined,
            fieldsSchema: t.fieldsSchema ?? undefined,
            scheduleEnabled: t.scheduleEnabled === true,
            scheduleType: t.scheduleType ?? undefined,
            scheduleDays: t.scheduleDays ?? undefined,
            scheduleTime: t.scheduleTime ?? undefined,
          } as any);
        }
      }

      start();
    } catch {
      setError(
        "Couldn’t finish adding your views. Some may already be saved. Reload to check them before trying again, or start with a note.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="memoato-onboarding">
      <header>
        <h1>A place to keep your context.</h1>
        <p>
          Remember life as it happens, or bring reliable context to your AI
          tools. Choose where to begin.
        </p>
      </header>
      <div className="memoato-start-paths">
        <button type="button" disabled={isSaving} onClick={() => start()}>
          <AppIcon name="memory" />
          <span>
            <strong>Start with a note</strong>
            <span>
              Capture a moment, an idea or a conversation. No setup needed.
            </span>
          </span>
          <span aria-hidden="true">↗</span>
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => start("/context")}
        >
          <AppIcon name="context" />
          <span>
            <strong>Explore Context for AI</strong>
            <span>
              Review sources and claims in a workspace, then build context for
              your tools.
            </span>
          </span>
          <span aria-hidden="true">↗</span>
        </button>
      </div>
      {privacy.mode !== "cloud" ? (
        <p className="memoato-onboarding-privacy">
          {privacy.mode === "local"
            ? "Your local notes stay on this device."
            : "Your encrypted notes stay private."}{" "}
          Context workspaces use separate cloud sources.
        </p>
      ) : null}
      <section
        className="memoato-optional-views"
        aria-labelledby="optional-views-title"
      >
        <h2 id="optional-views-title">Want to track something, too?</h2>
        <p>Optional views for numbers and habits. You can add these later.</p>
        {privacy.mode === "encrypted" && !canCreateEncrypted ? (
          <p className="memoato-inline-error">
            Unlock encryption from Profile → Privacy before adding views.
          </p>
        ) : null}
        {templatesQuery.isLoading ? (
          <p role="status">Loading optional views…</p>
        ) : templatesQuery.isError ? (
          <div role="alert" className="memoato-inline-error">
            <p>Couldn’t load optional views. You can still start above.</p>
            <button
              type="button"
              className="memoato-text-action"
              onClick={() => void templatesQuery.refetch()}
            >
              Try loading again
            </button>
          </div>
        ) : (
          <div className="memoato-template-list">
            {templates.map((t) => (
              <label key={t.key}>
                <input
                  type="checkbox"
                  checked={selectedKeys.has(t.key)}
                  disabled={isSaving}
                  onChange={() =>
                    setSelectedKeys((prev) => {
                      const next = new Set(prev);
                      if (next.has(t.key)) next.delete(t.key);
                      else next.add(t.key);
                      return next;
                    })
                  }
                />
                <span>{t.title}</span>
                <small>{fmtTemplateMeta(t)}</small>
              </label>
            ))}
          </div>
        )}
        {error ? (
          <p className="memoato-inline-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          onClick={onCreateSelected}
          disabled={isSaving || !selectedKeys.size || !canCreateEncrypted}
          className="mt-5"
        >
          {isSaving
            ? "Adding views…"
            : selectedKeys.size
              ? `Add ${selectedKeys.size} ${selectedKeys.size === 1 ? "view" : "views"} and continue`
              : "Select views to add"}
        </Button>
      </section>
    </div>
  );
}
