import React from "react";
import { recallMemory, useQuery } from "wasp/client/operations";
import { Button } from "../shared/components/Button";
import { MemoryEntryCard } from "./components/MemoryEntryCard";

const SUGGESTIONS = [
  "When did I last play football?",
  "body weight",
  "low energy",
  "pull ups",
];

export function RecallPage() {
  const [draft, setDraft] = React.useState("");
  const [query, setQuery] = React.useState("");
  const recall = useQuery(
    recallMemory,
    { query, take: 30 },
    { enabled: query.trim().length > 0 },
  );
  const data = recall.data as any;

  function submit(value = draft) {
    const cleaned = value.trim();
    if (!cleaned) return;
    setDraft(cleaned);
    setQuery(cleaned);
  }

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 pb-20 pt-7 sm:px-6 sm:pt-10">
      <section className="border-b border-neutral-300 pb-7 dark:border-neutral-700">
        <div className="label">Recall</div>
        <h2 className="mt-2 max-w-3xl text-4xl font-semibold leading-[0.98] tracking-[-0.06em] sm:text-6xl">
          Find the detail you didn’t know you’d need.
        </h2>
        <form
          className="mt-7 flex border-2 border-neutral-950 bg-white dark:border-neutral-100 dark:bg-neutral-950"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask naturally or search exact words…"
            className="min-h-14 min-w-0 flex-1 bg-transparent px-4 text-base font-medium outline-none placeholder:text-neutral-400 sm:min-h-16 sm:px-5 sm:text-lg"
            autoFocus
          />
          <Button
            type="submit"
            className="m-1 min-w-20 rounded-none sm:min-w-28"
          >
            Find
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => submit(suggestion)}
              className="border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-950 hover:bg-white dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-200 dark:hover:bg-neutral-900"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </section>

      {query ? (
        <section className="mt-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="label">Evidence</div>
              <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                {recall.isLoading
                  ? "Searching…"
                  : `${data?.count ?? 0} memories found`}
              </h3>
            </div>
            {data?.signal ? (
              <div className="border-l-2 border-[#ff5c35] pl-3 text-right">
                <div className="text-xl font-semibold tabular-nums">
                  {data.signal.latestValue}
                  {data.signal.unit ? ` ${data.signal.unit}` : ""}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">
                  Latest {data.signal.label}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {(data?.entries ?? []).map((entry: any) => (
              <MemoryEntryCard key={entry.id} entry={entry} compact />
            ))}
            {!recall.isLoading && (data?.entries ?? []).length === 0 ? (
              <div className="card p-10 text-center">
                <div className="text-xl font-semibold">
                  No matching evidence yet.
                </div>
                <p className="mt-2 text-sm text-neutral-500">
                  Try fewer words. Memoato searches originals, facts, and your
                  existing views.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="grid gap-3 pt-7 sm:grid-cols-3">
          {[
            [
              "01",
              "Original first",
              "Results always lead back to what you actually wrote.",
            ],
            [
              "02",
              "Human correction",
              "Fix one reading and Memoato remembers your language.",
            ],
            [
              "03",
              "No fake certainty",
              "Suggestions and inferences stay separate from facts.",
            ],
          ].map(([number, title, copy]) => (
            <div key={number} className="card p-5">
              <div className="text-[10px] font-bold tracking-[0.14em] text-[#ff5c35]">
                {number}
              </div>
              <div className="mt-5 text-base font-bold">{title}</div>
              <p className="mt-2 text-sm leading-6 text-neutral-500">{copy}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
