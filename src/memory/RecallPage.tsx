import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../shared/components/Button";
import { usePrivacy } from "../privacy/PrivacyProvider";
import { MemoryEntryCard } from "./components/MemoryEntryCard";
import { MemoryModeNotice } from "./components/MemoryModeNotice";
import { useMemoryRecall } from "./useMemoryRecall";
import "./memory.css";

const SUGGESTIONS = [
  "walks this week",
  "low energy",
  "release decisions",
  "meeting notes",
];
function modeLabel(mode?: string) {
  return mode === "hybrid"
    ? "Words and meaning"
    : mode === "semantic"
      ? "Meaning"
      : "Words";
}

export function RecallPage() {
  const privacy = usePrivacy();
  const recall = useMemoryRecall(privacy.mode === "cloud");
  const { data, query, answer } = recall;
  if (privacy.mode !== "cloud")
    return (
      <div className="memoato-memory-page">
        <MemoryModeNotice mode={privacy.mode} />
      </div>
    );
  return (
    <div className="memoato-memory-page memoato-recall-page">
      <header className="memoato-memory-page-heading">
        <div>
          <h1>Recall</h1>
          <p>Find a detail. Follow it back to what you wrote.</p>
        </div>
        <div className="memoato-memory-links">
          <Link to="/memory">
            Browse your notes <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>
      <form
        className="memoato-recall-form"
        onSubmit={(e) => {
          e.preventDefault();
          recall.submit();
        }}
      >
        <label htmlFor="memory-question">What are you looking for?</label>
        <div>
          <input
            id="memory-question"
            value={recall.draft}
            maxLength={240}
            onChange={(e) => recall.setDraft(e.target.value)}
            placeholder="Search a topic, a phrase or a time…"
          />
          <Button type="submit" disabled={!recall.draft.trim()}>
            Find
          </Button>
        </div>
      </form>
      {!query ? (
        <div className="memoato-recall-start">
          <p>Try a search</p>
          <div className="memoato-recall-suggestions">
            {SUGGESTIONS.map((suggestion) => (
              <button
                type="button"
                key={suggestion}
                onClick={() => recall.submit(suggestion)}
              >
                {suggestion}
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
          <p>Your originals are the source. AI answers are optional.</p>
        </div>
      ) : (
        <section
          className="memoato-recall-results"
          aria-labelledby="recall-sources-heading"
        >
          <div className="memoato-recall-result-heading">
            <div>
              <h2 id="recall-sources-heading">
                {recall.initialLoading
                  ? "Searching your notes…"
                  : recall.fast.isError && !data
                    ? "Search couldn’t finish."
                    : "Source notes"}
              </h2>
              <p>For “{query}”</p>
              {data ? (
                <p>
                  {data.count === 30
                    ? "Showing up to 30 matches"
                    : `${data.count} ${data.count === 1 ? "match" : "matches"}`}{" "}
                  · {modeLabel(data.mode)}
                  {data.range?.label ? ` · ${data.range.label}` : ""}
                </p>
              ) : null}
            </div>
            {data?.signal ? (
              <p className="memoato-recall-signal">
                Latest matching {data.signal.label}:{" "}
                <strong>
                  {data.signal.latestValue}
                  {data.signal.unit ? ` ${data.signal.unit}` : ""}
                </strong>
              </p>
            ) : null}
          </div>
          {recall.initialLoading ? (
            <p role="status" className="memoato-memory-loading">
              Looking for matching originals…
            </p>
          ) : null}
          {recall.fast.isError && !recall.initialLoading ? (
            <div role="alert" className="memoato-memory-warning">
              <p>
                {data
                  ? "These results may be out of date."
                  : "Couldn’t load matching notes. Your memory hasn’t changed."}
              </p>
              <Button variant="ghost" onClick={() => recall.submit(query)}>
                Try search again
              </Button>
            </div>
          ) : null}
          {recall.addingMeaning ? (
            <p role="status" className="memoato-memory-notice">
              Checking for matches by meaning. Word matches are ready below.
            </p>
          ) : recall.semantic.isError && data ? (
            <p role="status" className="memoato-memory-notice">
              Meaning search is unavailable. Showing word matches.
            </p>
          ) : null}
          {data && data.entries.length > 0 ? (
            <>
              <div className="memoato-recall-answer-action">
                <div>
                  <h3>An answer from these notes</h3>
                  <p>Optional AI summary with links to its sources.</p>
                </div>
                <Button
                  onClick={() => void recall.answerFromEvidence()}
                  disabled={
                    recall.answering ||
                    recall.addingMeaning ||
                    !recall.canAnswer
                  }
                >
                  {recall.answering
                    ? "Reading sources…"
                    : "Answer from these notes"}
                </Button>
                {!recall.canAnswer ? (
                  <p>
                    AI answers need original notes. These imported entries are
                    available to read below.
                  </p>
                ) : null}
              </div>
              {answer?.available ? (
                <article
                  className="memoato-recall-answer"
                  aria-label="AI answer"
                >
                  <h3>AI answer</h3>
                  <p className="memoato-answer-confidence">
                    {answer.confidence
                      ? `${answer.confidence} confidence · `
                      : ""}
                    Based on your notes
                  </p>
                  <p className="memoato-answer-text">{answer.answer}</p>
                  <nav
                    className="memoato-answer-citations"
                    aria-label="Answer sources"
                  >
                    {answer.citations
                      .filter((id) =>
                        data.entries.some((entry) => entry.id === id),
                      )
                      .map((id) => (
                        <a key={id} href={`#evidence-${id}`}>
                          Source{" "}
                          {data.entries.findIndex((entry) => entry.id === id) +
                            1}
                          <span aria-hidden="true">↓</span>
                        </a>
                      ))}
                  </nav>
                </article>
              ) : null}
              {recall.answerError ? (
                <p role="alert" className="memoato-inline-error">
                  {recall.answerError}
                </p>
              ) : null}
              <div className="memoato-recall-evidence">
                {data.entries.map((entry, index) => (
                  <div
                    id={`evidence-${entry.id}`}
                    key={entry.id}
                    className="memoato-evidence-note"
                  >
                    <p className="memoato-evidence-label">Source {index + 1}</p>
                    <MemoryEntryCard
                      entry={entry}
                      compact
                      onChanged={recall.refreshEvidence}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : data && !recall.addingMeaning && !recall.fast.isError ? (
            <div className="memoato-memory-empty">
              <h3>No matching notes yet.</h3>
              <p>
                Try fewer words or another phrase. Recall searches your
                originals, facts and existing views.
              </p>
              <Link className="memoato-text-action" to="/">
                Write something to remember
              </Link>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
