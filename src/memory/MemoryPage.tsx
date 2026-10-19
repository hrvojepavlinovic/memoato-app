import React from "react";
import { Link } from "react-router-dom";
import {
  getMemoryFeed,
  getMemoryOverview,
  useQuery,
} from "wasp/client/operations";
import { Button, ButtonLink } from "../shared/components/Button";
import { usePrivacy } from "../privacy/PrivacyProvider";
import { MemoryEntryCard } from "./components/MemoryEntryCard";
import { MemoryModeNotice } from "./components/MemoryModeNotice";
import type { MemoryFeed, MemoryOverview } from "./viewTypes";
import "./memory.css";

type Filter = "all" | "review" | "failed";
const filterLabels: Record<Filter, string> = {
  all: "All notes",
  review: "Needs review",
  failed: "Processing issues",
};

export function MemoryPage() {
  const privacy = usePrivacy();
  const [filter, setFilter] = React.useState<Filter>("all");
  const enabled = privacy.mode === "cloud";
  const overview = useQuery(getMemoryOverview, undefined, {
    enabled,
    refetchInterval: enabled ? 5000 : false,
  });
  const feed = useQuery(
    getMemoryFeed,
    { filter, take: 30 },
    {
      enabled,
      refetchInterval: (query: { state: { data?: unknown } }) =>
        (query.state.data as MemoryFeed | undefined)?.entries.some(
          (entry) =>
            entry.processingStatus === "queued" ||
            entry.processingStatus === "processing",
        )
          ? 5000
          : false,
    },
  );
  const counts = overview.data as MemoryOverview | undefined;
  const data = feed.data as MemoryFeed | undefined;
  const entries = data?.filter === filter ? data.entries : [];
  async function refresh() {
    await Promise.all([
      feed.refetch({ throwOnError: true }),
      overview.refetch({ throwOnError: true }),
    ]);
  }

  if (!enabled)
    return (
      <div className="memoato-memory-page">
        <MemoryModeNotice mode={privacy.mode} />
      </div>
    );

  return (
    <div className="memoato-memory-page">
      <header className="memoato-memory-page-heading">
        <div>
          <h1>Memory</h1>
          <p>Your original notes, with facts you can review and correct.</p>
        </div>
        <div className="memoato-memory-links">
          <Link to="/timeline">
            Day timeline <span aria-hidden="true">↗</span>
          </Link>
          <ButtonLink to="/recall">Find a memory</ButtonLink>
        </div>
      </header>
      <nav className="memoato-memory-filters" aria-label="Filter notes">
        {(["all", "review", "failed"] as Filter[]).map((item) => (
          <button
            type="button"
            key={item}
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
          >
            {filterLabels[item]}
            {counts && item !== "all" ? (
              <span className="memoato-filter-count">
                {item === "review"
                  ? `${counts.reviewCount} ${counts.reviewCount === 1 ? "fact" : "facts"}`
                  : `${counts.failedCount} ${counts.failedCount === 1 ? "note" : "notes"}`}
              </span>
            ) : null}
          </button>
        ))}
      </nav>
      {overview.isError ? (
        <div className="memoato-memory-warning" role="status">
          Review counts couldn’t load.
          <button
            type="button"
            className="memoato-text-action"
            onClick={() => void overview.refetch()}
          >
            Retry counts
          </button>
        </div>
      ) : null}
      <section
        className="memoato-memory-feed"
        aria-label={filterLabels[filter]}
      >
        {feed.isLoading ? (
          <div className="memoato-memory-loading" role="status">
            Loading your notes…
            <div aria-hidden="true" />
            <div aria-hidden="true" />
          </div>
        ) : null}
        {feed.isError ? (
          <div className="memoato-memory-empty" role="alert">
            <h2>Couldn’t load your notes.</h2>
            <p>
              {entries.length
                ? "The notes below may be out of date."
                : "Your notes haven’t changed. Try loading this list again."}
            </p>
            <Button variant="ghost" onClick={() => void feed.refetch()}>
              Try again
            </Button>
          </div>
        ) : null}
        {entries.map((entry) => (
          <MemoryEntryCard key={entry.id} entry={entry} onChanged={refresh} />
        ))}
        {!feed.isLoading && !feed.isError && data && entries.length === 0 ? (
          <div className="memoato-memory-empty">
            <h2>
              {filter === "review"
                ? "Nothing waiting for review."
                : filter === "failed"
                  ? "No processing issues."
                  : "Start with something worth keeping."}
            </h2>
            <p>
              {filter === "all"
                ? "A moment, a conversation or an idea. Write it on Today and your original will appear here."
                : filter === "review"
                  ? "Facts that need your attention will appear here, alongside the original note."
                  : "If fact processing fails, the original is kept and you can retry it here."}
            </p>
            {filter === "all" ? (
              <ButtonLink to="/">Write a note</ButtonLink>
            ) : (
              <button
                className="memoato-text-action"
                onClick={() => setFilter("all")}
              >
                Back to all notes
              </button>
            )}
          </div>
        ) : null}
      </section>
      {data?.nextBefore ? (
        <p className="memoato-memory-older">
          Showing the 30 most recent matching notes.{" "}
          <Link to="/timeline">Browse older entries by day</Link> or{" "}
          <Link to="/recall">search your memory</Link>.
        </p>
      ) : null}
    </div>
  );
}
