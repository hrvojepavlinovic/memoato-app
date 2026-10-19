import React from "react";
import "../shared/tools.css";
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

const EMPTY_CATEGORIES: CategoryWithStats[] = [];

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
  const [localLoading, setLocalLoading] = React.useState(true);
  const [localError, setLocalError] = React.useState(false);
  const [titles, setTitles] = React.useState<Record<string, string>>({});
  const categories =
    privacy.mode === "local"
      ? local
      : ((remote.data ?? EMPTY_CATEGORIES) as CategoryWithStats[]);

  React.useEffect(() => {
    if (privacy.mode !== "local" || !privacy.userId) return;
    let cancelled = false;
    setLocalLoading(true);
    setLocalError(false);
    void localGetCategoriesWithStats(privacy.userId)
      .then((data) => {
        if (!cancelled) setLocal(data);
      })
      .catch(() => {
        if (!cancelled) setLocalError(true);
      })
      .finally(() => {
        if (!cancelled) setLocalLoading(false);
      });
    return () => {
      cancelled = true;
    };
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

  const loading = privacy.mode === "local" ? localLoading : remote.isLoading;
  const failed = privacy.mode === "local" ? localError : remote.isError;
  return (
    <div className="memoato-tools-page">
      <header className="memoato-tools-heading">
        <div>
          <h1>Views</h1>
          <p>Charts, goals and routines from your saved entries.</p>
        </div>
        <div className="memoato-tools-actions">
          <ButtonLink to="/timeline" variant="ghost">
            Timeline
          </ButtonLink>
          <ButtonLink to="/categories/new">New view</ButtonLink>
        </div>
      </header>
      {loading ? (
        <p className="memoato-tools-state" role="status">
          Loading views…
        </p>
      ) : failed ? (
        <div className="memoato-tools-state" role="alert">
          <p>Views couldn’t be loaded. Refresh this page to try again.</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="memoato-tools-state">
          <p>No views yet. Add a chart, goal or routine when you need one.</p>
          <ButtonLink to="/categories/new">Create your first view</ButtonLink>
        </div>
      ) : (
        <div className="memoato-view-list">
          {categories.map((category) => {
            const title =
              titles[category.id] ??
              (isEncryptedString(category.title) ? "Locked" : category.title);
            const accent =
              resolveAccentForTheme(category.accentHex, theme.isDark) ??
              category.accentHex;
            const glance = categoryValue(category);
            return (
              <Link
                key={category.id}
                to={routes.CategoryRoute.to}
                params={{ categorySlug: category.slug }}
                className="memoato-view-row"
              >
                <span
                  className="memoato-view-symbol"
                  aria-hidden="true"
                  style={{ color: accent }}
                >
                  {category.emoji || (
                    <svg
                      viewBox="0 0 24 24"
                      width="24"
                      height="24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <path d="M4 19V5m0 14h16M8 15v-4m5 4V7m5 8V9" />
                    </svg>
                  )}
                </span>
                <div>
                  <div className="memoato-view-name">{title}</div>
                  <div className="memoato-view-meta">
                    {category.chartType === "line"
                      ? "Trend"
                      : category.categoryType === "DO" ||
                          category.categoryType === "DONT"
                        ? "Routine"
                        : category.categoryType === "GOAL"
                          ? "Goal"
                          : "Activity"}
                  </div>
                </div>
                <div className="memoato-view-value">
                  <strong>{glance.value}</strong>
                  <small>{glance.label}</small>
                </div>
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path d="M5 12h14m-5-5 5 5-5 5" />
                </svg>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
