import React from "react";
import {
  deleteMemoryEntry,
  retryMemoryEntry,
  reviewMemoryFact,
  updateMemoryEntry,
} from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import type { MemoryFactRecord, MemoryRecord } from "../viewTypes";
import "../memory.css";

function formatWhen(value: string | Date): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(date.getFullYear() !== new Date().getFullYear()
      ? ({ year: "numeric" } as const)
      : {}),
  }).format(date);
}
function factValue(fact: MemoryFactRecord): string | null {
  const sets = fact.data?.fact?.setValues;
  if (Array.isArray(sets) && sets.length) return sets.join(" · ");
  if (typeof fact.amount === "number")
    return `${Number.isInteger(fact.amount) ? fact.amount : fact.amount.toFixed(1)}${fact.unit ? ` ${fact.unit}` : ""}`;
  if (typeof fact.durationMinutes === "number")
    return `${Math.round(fact.durationMinutes)} min`;
  return null;
}
function processingLabel(status: string) {
  if (status === "queued") return "Waiting to process";
  if (status === "processing") return "Processing facts";
  if (status === "failed") return "Processing needs attention";
  if (status === "legacy") return "Imported entry";
  return "Original saved";
}
function factOrigin(origin?: string) {
  if (origin === "openrouter") return "Read with AI";
  if (origin === "human") return "Corrected by you";
  if (origin === "legacy") return "Imported from a view";
  return "Read from your words";
}

export function MemoryEntryCard({
  entry,
  onChanged,
  compact = false,
}: {
  entry: MemoryRecord;
  onChanged?: () => void | Promise<unknown>;
  compact?: boolean;
}) {
  const uid = React.useId();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingEntry, setEditingEntry] = React.useState(false);
  const [entryDraft, setEntryDraft] = React.useState(entry.rawText);
  const [draft, setDraft] = React.useState({ label: "", amount: "", unit: "" });
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [deleted, setDeleted] = React.useState(false);
  const [saving, setSaving] = React.useState<string | null>(null);
  const pending = React.useRef(false);
  const readOnly = entry.processingStatus === "legacy";
  const Heading = compact ? "h3" : "h2";
  const FactHeading = compact ? "h4" : "h3";

  async function mutate(
    key: string,
    work: () => Promise<unknown>,
    success: string,
    after?: () => void,
  ) {
    if (pending.current) return;
    pending.current = true;
    setSaving(key);
    setError("");
    setNotice("");
    try {
      await work();
      after?.();
      setNotice(success);
      try {
        await onChanged?.();
      } catch {
        setNotice(
          `${success} The list couldn’t refresh. Reload to see the latest version.`,
        );
      }
    } catch {
      setError(
        "Couldn’t confirm this change. Check Memory before trying again.",
      );
    } finally {
      pending.current = false;
      setSaving(null);
    }
  }

  function review(
    fact: MemoryFactRecord,
    action: "accept" | "reject" | "edit",
  ) {
    if (readOnly || /^(legacy:|event:)/.test(fact.id)) return;
    let amount: number | null = null;
    if (action === "edit") {
      if (!draft.label.trim()) {
        setError("Give this fact a label before saving.");
        return;
      }
      const value = draft.amount.trim().replace(",", ".");
      if (
        value &&
        (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) ||
          !Number.isFinite(Number(value)))
      ) {
        setError("Enter a number such as 2.5, or leave the value empty.");
        return;
      }
      amount = value ? Number(value) : null;
    }
    void mutate(
      fact.id,
      () =>
        reviewMemoryFact({
          factId: fact.id,
          action,
          ...(action === "edit"
            ? {
                ...(draft.label.trim() !== (fact.canonical || fact.label)
                  ? { label: draft.label.trim(), canonical: draft.label.trim() }
                  : {}),
                ...(amount !== (fact.amount ?? null) ? { amount } : {}),
                ...(draft.unit.trim() !== (fact.unit || "")
                  ? { unit: draft.unit.trim() || null }
                  : {}),
              }
            : {}),
        }),
      action === "reject"
        ? "Fact dismissed. Your original is unchanged."
        : "Fact saved. Your original is unchanged.",
      () => setEditingId(null),
    );
  }
  function saveEntry() {
    const rawText = entryDraft.trim();
    if (!rawText) {
      setError("A note cannot be empty.");
      return;
    }
    void mutate(
      "original",
      () => updateMemoryEntry({ rawEntryId: entry.id, rawText }),
      "Original saved. Its facts will be processed again.",
      () => setEditingEntry(false),
    );
  }
  function removeEntry() {
    if (
      pending.current ||
      !window.confirm(
        "Delete this memory and every fact created from it? This cannot be undone.",
      )
    )
      return;
    void mutate(
      "delete",
      () => deleteMemoryEntry({ rawEntryId: entry.id }),
      "Note deleted.",
      () => setDeleted(true),
    );
  }
  if (deleted) return null;

  return (
    <article
      className={
        compact
          ? "memoato-memory-entry memoato-memory-entry--compact"
          : "memoato-memory-entry"
      }
      aria-labelledby={`${uid}-original ${uid}-when`}
    >
      <header className="memoato-entry-heading">
        <Heading id={`${uid}-original`}>
          {readOnly ? "Imported entry" : "Original note"}
        </Heading>
        <time
          id={`${uid}-when`}
          dateTime={new Date(entry.occurredAt).toISOString()}
        >
          {formatWhen(entry.occurredAt)}
        </time>
        <span>
          {entry.source === "app" ? "Memoato" : entry.source || "Memoato"}
        </span>
      </header>
      {editingEntry ? (
        <div className="memoato-original-editor">
          <label htmlFor={`${uid}-text`}>Original note</label>
          <textarea
            id={`${uid}-text`}
            value={entryDraft}
            onChange={(e) => setEntryDraft(e.target.value)}
            maxLength={4000}
            rows={4}
            disabled={!!saving}
            autoFocus
          />
          <p>Saving the original will process its facts again.</p>
          <div className="memoato-entry-actions">
            <Button onClick={saveEntry} disabled={!!saving}>
              {saving === "original" ? "Saving…" : "Save original"}
            </Button>
            <button
              type="button"
              disabled={!!saving}
              onClick={() => {
                setEditingEntry(false);
                setError("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="memoato-original-text">{entry.rawText}</p>
      )}
      <div className="memoato-entry-status">
        {processingLabel(entry.processingStatus)}
      </div>
      {!readOnly && !editingEntry ? (
        <div className="memoato-entry-actions memoato-original-actions">
          <button
            type="button"
            disabled={!!saving}
            onClick={() => {
              setEditingEntry(true);
              setEditingId(null);
              setEntryDraft(entry.rawText);
              setError("");
              setNotice("");
            }}
          >
            Edit original
          </button>
          <button type="button" disabled={!!saving} onClick={removeEntry}>
            Delete note
          </button>
        </div>
      ) : null}
      {entry.facts?.length ? (
        <section
          className="memoato-entry-facts"
          aria-label="Facts from this note"
        >
          <FactHeading>Facts from this note</FactHeading>
          {entry.facts.map((fact) => {
            const value = factValue(fact),
              editing = editingId === fact.id;
            const canReview = !readOnly && !/^(legacy:|event:)/.test(fact.id);
            return (
              <div className="memoato-memory-fact" key={fact.id}>
                <div className="memoato-fact-summary">
                  <strong>{fact.canonical || fact.label}</strong>
                  {value ? (
                    <span className="memoato-fact-value">{value}</span>
                  ) : null}
                  <span
                    className={
                      fact.status === "needs_review"
                        ? "memoato-fact-review"
                        : "memoato-fact-state"
                    }
                  >
                    {fact.status === "needs_review"
                      ? "Needs your review"
                      : fact.status === "rejected"
                        ? "Dismissed"
                        : "Accepted"}
                  </span>
                </div>
                <p className="memoato-fact-origin">
                  {factOrigin(fact.origin)}
                  {typeof fact.confidence === "number" &&
                  fact.origin !== "human" &&
                  fact.origin !== "legacy"
                    ? ` · ${Math.round(fact.confidence * 100)}% confidence`
                    : ""}
                </p>
                {canReview && !editing ? (
                  <div className="memoato-entry-actions">
                    {fact.status !== "accepted" ? (
                      <button
                        type="button"
                        disabled={!!saving || editingEntry}
                        onClick={() => review(fact, "accept")}
                      >
                        {saving === fact.id
                          ? "Saving…"
                          : fact.status === "rejected"
                            ? "Restore fact"
                            : "Keep fact"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={!!saving || editingEntry}
                      onClick={() => {
                        setEditingId(fact.id);
                        setError("");
                        setNotice("");
                        setDraft({
                          label: fact.canonical || fact.label,
                          amount:
                            fact.amount == null ? "" : String(fact.amount),
                          unit: fact.unit || "",
                        });
                      }}
                    >
                      Edit fact
                    </button>
                    {fact.status !== "rejected" ? (
                      <button
                        type="button"
                        disabled={!!saving || editingEntry}
                        onClick={() => review(fact, "reject")}
                      >
                        Dismiss fact
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {editing ? (
                  <form
                    className="memoato-fact-editor"
                    onSubmit={(e) => {
                      e.preventDefault();
                      review(fact, "edit");
                    }}
                  >
                    <label>
                      Label
                      <input
                        value={draft.label}
                        maxLength={160}
                        disabled={!!saving}
                        onChange={(e) =>
                          setDraft((v) => ({ ...v, label: e.target.value }))
                        }
                        autoFocus
                      />
                    </label>
                    <label>
                      Value
                      <input
                        value={draft.amount}
                        inputMode="decimal"
                        disabled={!!saving}
                        onChange={(e) =>
                          setDraft((v) => ({ ...v, amount: e.target.value }))
                        }
                        placeholder="Optional"
                      />
                    </label>
                    <label>
                      Unit
                      <input
                        value={draft.unit}
                        maxLength={32}
                        disabled={!!saving}
                        onChange={(e) =>
                          setDraft((v) => ({ ...v, unit: e.target.value }))
                        }
                        placeholder="Optional"
                      />
                    </label>
                    <div className="memoato-entry-actions">
                      <Button type="submit" disabled={!!saving}>
                        {saving === fact.id ? "Saving…" : "Save fact"}
                      </Button>
                      <button
                        type="button"
                        disabled={!!saving}
                        onClick={() => {
                          setEditingId(null);
                          setError("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}
      {entry.processingStatus === "failed" ? (
        <div className="memoato-entry-retry">
          <p>Your original is saved. Only fact processing failed.</p>
          <Button
            variant="ghost"
            disabled={!!saving}
            onClick={() =>
              void mutate(
                "retry",
                () => retryMemoryEntry({ rawEntryId: entry.id }),
                "Processing queued. Your original is unchanged.",
              )
            }
          >
            {saving === "retry" ? "Queuing…" : "Retry processing"}
          </Button>
        </div>
      ) : null}
      <p role="status" className="memoato-memory-notice">
        {saving
          ? saving === "delete"
            ? "Deleting note…"
            : saving === "retry"
              ? "Queuing processing…"
              : "Saving change…"
          : notice}
      </p>
      {error ? (
        <p role="alert" className="memoato-inline-error">
          {error}
        </p>
      ) : null}
    </article>
  );
}
