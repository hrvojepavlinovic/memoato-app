import React from "react";
import {
  answerMemoryRecall,
  recallMemory,
  useQuery,
} from "wasp/client/operations";
import { Button } from "../shared/components/Button";
import { MemoryEntryCard } from "./components/MemoryEntryCard";

const SUGGESTIONS = [
  "Kad sam zadnji put igrao nogomet?",
  "body weight last 30 days",
  "niska energija ovaj tjedan",
  "pull ups / zgibovi",
];

function modeLabel(mode: string | undefined) {
  if (mode === "hybrid") return "Words + meaning";
  if (mode === "semantic") return "Meaning";
  return "Words";
}

export function RecallPage() {
  const [draft, setDraft] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [answer, setAnswer] = React.useState<any>(null);
  const [answerError, setAnswerError] = React.useState("");
  const [answering, setAnswering] = React.useState(false);
  const fastRecall = useQuery(
    recallMemory,
    { query, take: 30, semantic: false },
    {
      enabled: query.trim().length > 0,
      staleTime: 5 * 60_000,
    },
  );
  const fastData =
    (fastRecall.data as any)?.query === query ? (fastRecall.data as any) : null;
  const semanticRecall = useQuery(
    recallMemory,
    { query, take: 30, semantic: true },
    {
      enabled: query.trim().length > 0 && fastData != null,
      staleTime: 5 * 60_000,
      retry: false,
    },
  );
  const semanticData =
    (semanticRecall.data as any)?.query === query
      ? (semanticRecall.data as any)
      : null;
  const data = semanticData ?? fastData;
  const isInitialLoading = query.length > 0 && !fastData;
  const isAddingMeaning =
    fastData != null && semanticData == null && semanticRecall.isFetching;

  function submit(value = draft) {
    const cleaned = value.trim();
    if (!cleaned) return;
    setDraft(cleaned);
    setAnswer(null);
    setAnswerError("");
    setQuery(cleaned);
  }

  async function answerFromEvidence() {
    const entryIds = (data?.entries ?? [])
      .filter((entry: any) => entry.processingStatus !== "legacy")
      .map((entry: any) => entry.id)
      .slice(0, 8);
    if (entryIds.length === 0) return;
    setAnswering(true);
    setAnswerError("");
    try {
      const result = await answerMemoryRecall({ query, entryIds } as any);
      setAnswer(result);
      if (!(result as any)?.available) {
        setAnswerError(
          "AI synthesis is temporarily unavailable. Your evidence is still below.",
        );
      }
    } catch {
      setAnswerError(
        "Couldn’t synthesize an answer right now. Your evidence is unchanged.",
      );
    } finally {
      setAnswering(false);
    }
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
              <div className="flex flex-wrap items-center gap-2">
                <div className="label">Evidence</div>
                {!isInitialLoading && data ? (
                  <span className="border border-neutral-300 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                    {modeLabel(data.mode)}
                  </span>
                ) : null}
                {isAddingMeaning ? (
                  <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-400">
                    Adding meaning…
                  </span>
                ) : null}
                {data?.range?.label ? (
                  <span className="border border-neutral-300 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                    {data.range.label}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                {isInitialLoading
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

          {!isInitialLoading && (data?.entries ?? []).length > 0 ? (
            <div className="mt-4 border-2 border-neutral-950 bg-[#f7f4ed] p-4 dark:border-neutral-100 dark:bg-neutral-900 sm:flex sm:items-center sm:justify-between sm:gap-5">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#ff5c35]">
                  Grounded synthesis
                </div>
                <p className="mt-1 max-w-2xl text-sm leading-5 text-neutral-600 dark:text-neutral-300">
                  Ask AI to summarize only the evidence below. Raw entries stay
                  visible and every claim must cite one of them.
                </p>
              </div>
              <Button
                className="mt-3 w-full flex-none sm:mt-0 sm:w-auto"
                onClick={answerFromEvidence}
                disabled={answering}
              >
                {answering ? "Reading evidence…" : "Answer from evidence"}
              </Button>
            </div>
          ) : null}

          {answer?.available ? (
            <article className="mt-3 border-l-4 border-[#ff5c35] bg-neutral-950 p-5 text-white dark:bg-neutral-100 dark:text-neutral-950">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#ff8a6d] dark:text-[#d94724]">
                  Answer grounded in your entries
                </div>
                <div className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-60">
                  {answer.confidence} confidence · AI synthesis
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-base font-medium leading-7">
                {answer.answer}
              </p>
              {answer.citations?.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {answer.citations.map((id: string) => {
                    const index = (data?.entries ?? []).findIndex(
                      (entry: any) => entry.id === id,
                    );
                    return (
                      <a
                        key={id}
                        href={`#evidence-${id}`}
                        className="border border-white/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] hover:border-[#ff8a6d] dark:border-neutral-950/30"
                      >
                        Evidence {index >= 0 ? index + 1 : ""}
                      </a>
                    );
                  })}
                </div>
              ) : null}
            </article>
          ) : null}

          {answerError ? (
            <div className="mt-3 border border-amber-400 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
              {answerError}
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {(data?.entries ?? []).map((entry: any) => (
              <div
                key={entry.id}
                id={`evidence-${entry.id}`}
                className="scroll-mt-24"
              >
                <MemoryEntryCard entry={entry} compact />
              </div>
            ))}
            {!isInitialLoading &&
            !isAddingMeaning &&
            (data?.entries ?? []).length === 0 ? (
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
