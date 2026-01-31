import { useEffect, useRef, useState } from "react";
import { Link, routes } from "wasp/client/router";
import { ensureDefaultCategories, getCategories, useQuery } from "wasp/client/operations";
import type { CategoryWithStats } from "./types";
import { ButtonLink } from "../shared/components/Button";
import { usePrivacy } from "../privacy/PrivacyProvider";
import { decryptCategoryTitle } from "../privacy/decryptors";
import { isEncryptedString } from "../privacy/crypto";
import { localCreateCategory, localGetCategoriesWithStats } from "./local";

function formatValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

function titleKey(title: string): string {
  return title.trim().toLowerCase();
}

function periodLabel(p: CategoryWithStats["period"]): string {
  if (p === "day") return "Today";
  if (p === "month") return "This month";
  if (p === "year") return "This year";
  return "This week";
}

function withHexAlpha(hex: string, alphaHex: string): string | null {
  const h = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) return null;
  if (!/^[0-9a-fA-F]{2}$/.test(alphaHex)) return null;
  return `${h}${alphaHex}`;
}

function GoalProgress({ c }: { c: CategoryWithStats }) {
  const goal = c.goalWeekly ?? 0;
  const done = c.thisWeekTotal;
  const pct = goal > 0 ? Math.min(1, Math.max(0, done / goal)) : 0;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500">
        <span>{periodLabel(c.period)}</span>
        <span className="tabular-nums">
          {formatValue(done)} / {formatValue(goal)}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct * 100}%`, backgroundColor: c.accentHex }}
          aria-label={`${periodLabel(c.period)} progress`}
        />
      </div>
    </div>
  );
}

function formatWeekGlance(c: CategoryWithStats, displayTitle: string): string {
  if (c.chartType === "line") {
    const last = c.lastValue == null ? "—" : formatValue(c.lastValue);
    const goal = c.goalValue == null ? null : formatValue(c.goalValue);
    const unit = c.unit && c.unit !== "x" ? ` ${c.unit}` : "";
    return goal ? `${last}${unit} · Goal: ${goal}${unit}` : `${last}${unit}`;
  }

  if (c.goalWeekly != null && c.goalWeekly > 0) {
    return "";
  }

  const k = titleKey(displayTitle);
  if (k === "padel" || k === "football") {
    return `This year: ${formatValue(c.thisYearTotal)}`;
  }
  return `${periodLabel(c.period)}: ${formatValue(c.thisWeekTotal)}`;
}

export function HomePage() {
  const privacy = usePrivacy();
  const categoriesQuery = useQuery(getCategories, undefined, { enabled: privacy.mode !== "local" });
  const [localCategories, setLocalCategories] = useState<CategoryWithStats[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const categories = privacy.mode === "local" ? localCategories : (categoriesQuery.data ?? []);
  const isLoading = privacy.mode === "local" ? localLoading : categoriesQuery.isLoading;
  const isSuccess = privacy.mode === "local" ? true : categoriesQuery.isSuccess;
  const ensuredOnceRef = useRef(false);
  const [titleById, setTitleById] = useState<Record<string, string>>({});

  useEffect(() => {
    if (privacy.mode === "local") return;
    if (!isSuccess) return;
    if (ensuredOnceRef.current) return;
    ensuredOnceRef.current = true;
    (async () => {
      await ensureDefaultCategories();
      await categoriesQuery.refetch();
    })();
  }, [categories, categoriesQuery, isSuccess]);

  useEffect(() => {
    if (privacy.mode !== "local") return;
    if (!privacy.userId) return;
    let cancelled = false;
    (async () => {
      setLocalLoading(true);
      try {
        let cats = await localGetCategoriesWithStats(privacy.userId!);
        if (cats.length === 0) {
          await localCreateCategory({
            userId: privacy.userId!,
            title: "Push ups",
            categoryType: "NUMBER",
            period: "week",
            unit: null,
            goal: 300,
            goalValue: null,
            accentHex: "#F59E0B",
            emoji: "💪",
          });
          await localCreateCategory({
            userId: privacy.userId!,
            title: "Weight",
            categoryType: "GOAL",
            unit: "kg",
            goal: null,
            goalValue: 85,
            accentHex: "#0EA5E9",
            emoji: "⚖️",
          });
          cats = await localGetCategoriesWithStats(privacy.userId!);
        }
        if (!cancelled) setLocalCategories(cats);
      } finally {
        if (!cancelled) setLocalLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [privacy.mode, privacy.userId]);

  useEffect(() => {
    if (privacy.mode !== "local") return;
    const userId = privacy.userId;
    if (!userId) return;
    const onChanged = (e: any) => {
      if (e?.detail?.userId !== userId) return;
      localGetCategoriesWithStats(userId).then((cats) => setLocalCategories(cats));
    };
    window.addEventListener("memoato:localChanged", onChanged);
    return () => window.removeEventListener("memoato:localChanged", onChanged);
  }, [privacy.mode, privacy.userId]);

  useEffect(() => {
    let cancelled = false;
    if (!privacy.key) {
      setTitleById({});
      return;
    }
    (async () => {
      const pairs = await Promise.all(
        categories.map(async (c) => {
          if (!isEncryptedString(c.title)) return [c.id, null] as const;
          const t = await decryptCategoryTitle(privacy.key as CryptoKey, c.title);
          return [c.id, t] as const;
        }),
      );
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [id, t] of pairs) {
        if (t) next[id] = t;
      }
      setTitleById(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [categories, privacy.key]);

  if (isLoading) {
    return <div className="mx-auto w-full max-w-screen-lg px-4 py-6" />;
  }

  if (!isSuccess) {
    return <div className="px-4 py-8 text-red-600">Failed to load.</div>;
  }

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Categories</h2>
          <p className="text-sm text-neutral-500">Tap to add and view history.</p>
        </div>
        <ButtonLink to="/categories/new">Add category</ButtonLink>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {categories.map((c) => {
        const isEncrypted = isEncryptedString(c.title);
        const displayTitle = titleById[c.id] ?? (isEncrypted ? "Locked" : c.title);

          const goalReached =
            c.chartType === "line"
              ? c.goalValue != null && c.lastValue != null && c.lastValue <= c.goalValue
              : c.goalWeekly != null && c.goalWeekly > 0 && c.thisWeekTotal >= c.goalWeekly;

          const goalBg = goalReached ? withHexAlpha(c.accentHex, "08") : null;

          return (
            <Link
              key={c.id}
              to={routes.CategoryRoute.to}
              params={{ categorySlug: c.slug }}
              className="card flex min-h-20 flex-col justify-between p-4 active:scale-[0.99]"
              style={{
                borderColor: goalReached ? c.accentHex : undefined,
                backgroundColor: goalBg ?? undefined,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-base font-semibold">{displayTitle}</div>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full border bg-white"
                  style={{ borderColor: c.accentHex }}
                  aria-hidden="true"
                >
                  <div className="text-lg leading-none">{c.emoji ?? ""}</div>
                </div>
              </div>
              {c.chartType !== "line" && c.goalWeekly != null && c.goalWeekly > 0 ? (
                <GoalProgress c={c} />
              ) : (
                <div className="mt-2 text-xs font-medium text-neutral-500">
                  {formatWeekGlance(c, displayTitle)}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
