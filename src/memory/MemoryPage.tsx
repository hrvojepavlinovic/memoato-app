import React from "react";
import {
  getMemoryFeed,
  getMemoryOverview,
  useQuery,
} from "wasp/client/operations";
import { ButtonLink } from "../shared/components/Button";
import { usePrivacy } from "../privacy/PrivacyProvider";
import { MemoryEntryCard } from "./components/MemoryEntryCard";

type Filter = "all" | "review" | "failed";

export function MemoryPage() {
  const privacy = usePrivacy();
  const [filter, setFilter] = React.useState<Filter>("all");
  const overview = useQuery(getMemoryOverview, undefined, {
    enabled: privacy.mode !== "local",
    refetchInterval: 5_000,
  });
  const feed = useQuery(
    getMemoryFeed,
    { filter, take: 30 },
    {
      enabled: privacy.mode !== "local",
      refetchInterval: filter === "failed" ? 8_000 : false,
    },
  );

  if (privacy.mode === "local") {
    return (
      <div className="mx-auto w-full max-w-screen-lg px-4 py-10 sm:px-6">
        <div className="max-w-2xl border-l-4 border-[#ff5c35] pl-5">
          <div className="label">Local-only mode</div>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
            This memory never leaves this device.
          </h2>
          <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            Memory review and cross-device recall need cloud mode. Your local
            categories and entries stay exactly where they are.
          </p>
          <ButtonLink to="/profile" className="mt-5">
            Privacy settings
          </ButtonLink>
        </div>
      </div>
    );
  }

  const overviewData = overview.data as any;
  const entries = ((feed.data as any)?.entries ?? []) as any[];

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 pb-20 pt-7 sm:px-6 sm:pt-10">
      <section className="grid gap-6 border-b border-neutral-300 pb-7 dark:border-neutral-700 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
            <span className="h-2 w-2 bg-[#ff5c35]" />
            Evidence, not summaries
          </div>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
            Your actual memory.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            Every original entry stays intact. Memoato’s reading sits underneath
            it, visible and correctable.
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink to="/timeline" variant="ghost">
            Day timeline
          </ButtonLink>
          <ButtonLink to="/recall">Recall something</ButtonLink>
        </div>
      </section>

      <section className="grid grid-cols-3 border-x border-b border-neutral-300 dark:border-neutral-700">
        {[
          ["Today", overviewData?.capturedToday ?? 0],
          ["Review", overviewData?.reviewCount ?? 0],
          ["Failed", overviewData?.failedCount ?? 0],
        ].map(([label, value], index) => (
          <div
            key={String(label)}
            className={`p-4 sm:p-5 ${index > 0 ? "border-l border-neutral-300 dark:border-neutral-700" : ""}`}
          >
            <div className="text-2xl font-semibold tabular-nums tracking-[-0.04em] sm:text-3xl">
              {value}
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
              {label}
            </div>
          </div>
        ))}
      </section>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 border border-neutral-300 p-1 dark:border-neutral-700">
          {(["all", "review", "failed"] as Filter[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`min-h-8 px-3 text-xs font-bold capitalize ${filter === item ? "bg-neutral-950 text-white dark:bg-neutral-100 dark:text-neutral-950" : "text-neutral-600 hover:bg-white dark:text-neutral-300 dark:hover:bg-neutral-900"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">
          {overviewData?.processing?.mode === "hybrid"
            ? "Local rules + OpenRouter when needed"
            : "Local rules only"}
        </div>
      </div>

      <section className="mt-4 space-y-3">
        {feed.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-40 animate-pulse border border-neutral-200 bg-white/50 dark:border-neutral-800 dark:bg-neutral-900/50"
              />
            ))}
          </div>
        ) : entries.length > 0 ? (
          entries.map((entry) => (
            <MemoryEntryCard
              key={entry.id}
              entry={entry}
              onChanged={() => {
                void feed.refetch();
                void overview.refetch();
              }}
            />
          ))
        ) : (
          <div className="card p-8 text-center sm:p-12">
            <div className="text-2xl font-semibold tracking-[-0.04em]">
              Nothing in this queue.
            </div>
            <p className="mt-2 text-sm text-neutral-500">
              Capture life on Today. It will appear here with its source intact.
            </p>
            <ButtonLink to="/" className="mt-5">
              Capture a memory
            </ButtonLink>
          </div>
        )}
      </section>
    </div>
  );
}
