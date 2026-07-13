import React from "react";
import { Link, routes } from "wasp/client/router";
import { getCategories, useQuery } from "wasp/client/operations";
import { ButtonLink } from "../shared/components/Button";
import { usePrivacy } from "../privacy/PrivacyProvider";
import { decryptCategoryTitle } from "../privacy/decryptors";
import { isEncryptedString } from "../privacy/crypto";
import { localGetCategoriesWithStats } from "./local";
import type { CategoryWithStats } from "./types";
import { resolveAccentForTheme } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function categoryValue(category: CategoryWithStats): {
  value: string;
  label: string;
} {
  const unit =
    category.unit && category.unit !== "x" ? ` ${category.unit}` : "";
  if (category.chartType === "line") {
    return {
      value:
        category.lastValue == null
          ? "—"
          : `${formatValue(category.lastValue)}${unit}`,
      label: "latest",
    };
  }
  const period =
    category.period === "day"
      ? "today"
      : category.period === "month"
        ? "this month"
        : category.period === "year"
          ? "this year"
          : "this week";
  return {
    value: `${formatValue(category.thisWeekTotal)}${unit}`,
    label: period,
  };
}

export function ViewsPage() {
  const privacy = usePrivacy();
  const theme = useTheme();
  const remote = useQuery(getCategories, undefined, {
    enabled: privacy.mode !== "local",
  });
  const [local, setLocal] = React.useState<CategoryWithStats[]>([]);
  const [titles, setTitles] = React.useState<Record<string, string>>({});
  const categories =
    privacy.mode === "local"
      ? local
      : ((remote.data ?? []) as CategoryWithStats[]);

  React.useEffect(() => {
    if (privacy.mode !== "local" || !privacy.userId) return;
    void localGetCategoriesWithStats(privacy.userId).then(setLocal);
  }, [privacy.mode, privacy.userId]);

  React.useEffect(() => {
    let cancelled = false;
    if (!privacy.key) {
      setTitles({});
      return;
    }
    void Promise.all(
      categories.map(async (category) => {
        if (!isEncryptedString(category.title))
          return [category.id, category.title] as const;
        return [
          category.id,
          (await decryptCategoryTitle(
            privacy.key as CryptoKey,
            category.title,
          )) ?? "Locked",
        ] as const;
      }),
    ).then((pairs) => {
      if (!cancelled) setTitles(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [categories, privacy.key]);

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 pb-20 pt-7 sm:px-6 sm:pt-10">
      <section className="flex flex-col justify-between gap-5 border-b border-neutral-300 pb-7 dark:border-neutral-700 sm:flex-row sm:items-end">
        <div>
          <div className="label">Views</div>
          <h2 className="mt-2 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
            Your life, shaped when useful.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            Goals, charts and routines are views over memory—not boxes you must
            fill before living.
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink to="/timeline" variant="ghost">
            Timeline
          </ButtonLink>
          <ButtonLink to="/categories/new">New view</ButtonLink>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => {
          const title =
            titles[category.id] ??
            (isEncryptedString(category.title) ? "Locked" : category.title);
          const accent =
            resolveAccentForTheme(category.accentHex, theme.isDark) ??
            category.accentHex;
          const glance = categoryValue(category);
          return (
            <div
              key={category.id}
              className="card group relative min-h-40 overflow-hidden p-5 hover:border-neutral-950 dark:hover:border-neutral-200"
            >
              <Link
                to={routes.CategoryRoute.to}
                params={{ categorySlug: category.slug }}
                className="absolute inset-0 z-10"
                aria-label={`Open ${title}`}
              />
              <div
                className="absolute inset-x-0 top-0 h-[3px]"
                style={{ backgroundColor: accent }}
              />
              <div className="flex items-start justify-between gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center border bg-white text-lg dark:bg-neutral-950"
                  style={{ borderColor: accent }}
                >
                  {category.emoji ?? ""}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">
                  {category.chartType === "line"
                    ? "signal"
                    : category.unit || "count"}
                </div>
              </div>
              <div className="mt-7 truncate text-lg font-bold tracking-[-0.025em]">
                {title}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums tracking-[-0.04em]">
                  {glance.value}
                </span>
                <span className="text-xs font-medium text-neutral-500">
                  {glance.label}
                </span>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
