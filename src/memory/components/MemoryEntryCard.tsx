import React from "react";
import { retryMemoryEntry, reviewMemoryFact } from "wasp/client/operations";
import { Button } from "../../shared/components/Button";

function formatWhen(value: string | Date): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function factValue(fact: any): string | null {
  if (
    Array.isArray(fact?.data?.fact?.setValues) &&
    fact.data.fact.setValues.length > 0
  ) {
    return fact.data.fact.setValues.join(" · ");
  }
  if (typeof fact.amount === "number")
    return `${Number.isInteger(fact.amount) ? fact.amount : fact.amount.toFixed(1)}${fact.unit ? ` ${fact.unit}` : ""}`;
  if (typeof fact.durationMinutes === "number")
    return `${Math.round(fact.durationMinutes)} min`;
  return null;
}

function statusLabel(status: string): string {
  if (status === "queued") return "Queued";
  if (status === "processing") return "Reading";
  if (status === "failed") return "Needs retry";
  if (status === "legacy") return "Imported";
  return "Remembered";
}

export function MemoryEntryCard({
  entry,
  onChanged,
  compact = false,
}: {
  entry: any;
  onChanged?: () => void;
  compact?: boolean;
}) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState({ label: "", amount: "", unit: "" });
  const [saving, setSaving] = React.useState<string | null>(null);

  async function review(fact: any, action: "accept" | "reject" | "edit") {
    if (String(fact.id).startsWith("legacy:")) return;
    setSaving(fact.id);
    try {
      await reviewMemoryFact({
        factId: fact.id,
        action,
        ...(action === "edit"
          ? {
              label: draft.label.trim() || fact.label,
              amount: draft.amount.trim()
                ? Number(draft.amount.replace(",", "."))
                : fact.amount,
              unit: draft.unit.trim() || null,
            }
          : {}),
      } as any);
      setEditingId(null);
      onChanged?.();
    } finally {
      setSaving(null);
    }
  }

  async function retry() {
    setSaving(entry.id);
    try {
      await retryMemoryEntry({ rawEntryId: entry.id });
      onChanged?.();
    } finally {
      setSaving(null);
    }
  }

  return (
    <article
      className="card overflow-hidden"
      style={
        compact
          ? undefined
          : ({
              contentVisibility: "auto",
              containIntrinsicSize: "0 220px",
            } as React.CSSProperties)
      }
    >
      <div className={compact ? "p-4" : "p-4 sm:p-5"}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
            <span
              className={`h-1.5 w-1.5 flex-none ${entry.processingStatus === "failed" ? "bg-red-500" : entry.processingStatus === "complete" || entry.processingStatus === "legacy" ? "bg-emerald-500" : "animate-pulse bg-[#ff5c35]"}`}
            />
            <span>{statusLabel(entry.processingStatus)}</span>
            {entry.primaryLabel?.label ? (
              <>
                <span className="text-neutral-300 dark:text-neutral-700">
                  /
                </span>
                <span className="truncate text-neutral-700 dark:text-neutral-300">
                  {entry.primaryLabel.domain} · {entry.primaryLabel.label}
                </span>
              </>
            ) : null}
            <span className="text-neutral-300 dark:text-neutral-700">/</span>
            <span className="truncate">{entry.source || "app"}</span>
          </div>
          <time className="flex-none text-[11px] font-medium tabular-nums text-neutral-500 dark:text-neutral-400">
            {formatWhen(entry.occurredAt)}
          </time>
        </div>

        <p
          className={`${compact ? "mt-2 text-sm" : "mt-3 text-base sm:text-lg"} whitespace-pre-wrap font-medium leading-relaxed tracking-[-0.015em] text-neutral-950 dark:text-neutral-100`}
        >
          {entry.rawText}
        </p>

        {entry.facts?.length > 0 ? (
          <div className="mt-4 space-y-2">
            {entry.facts.map((fact: any) => {
              const needsReview = fact.status === "needs_review";
              const value = factValue(fact);
              const editing = editingId === fact.id;
              return (
                <div
                  key={fact.id}
                  className={`border p-3 ${needsReview ? "border-amber-400 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/20" : "border-neutral-200 bg-white/60 dark:border-neutral-800 dark:bg-neutral-950/40"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-neutral-950 dark:text-neutral-100">
                          {fact.canonical || fact.label}
                        </span>
                        {value ? (
                          <span className="bg-neutral-950 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white dark:bg-neutral-100 dark:text-neutral-950">
                            {value}
                          </span>
                        ) : null}
                        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-500">
                          {fact.kind}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                        {fact.origin === "openrouter"
                          ? "Read with AI"
                          : fact.origin === "human"
                            ? "Corrected by you"
                            : "Read locally"}
                        {typeof fact.confidence === "number"
                          ? ` · ${Math.round(fact.confidence * 100)}% confidence`
                          : ""}
                      </div>
                    </div>
                    {!String(fact.id).startsWith("legacy:") ? (
                      <div className="flex flex-none gap-1">
                        {needsReview ? (
                          <Button
                            size="xs"
                            onClick={() => review(fact, "accept")}
                            disabled={saving === fact.id}
                          >
                            Keep
                          </Button>
                        ) : null}
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(editing ? null : fact.id);
                            setDraft({
                              label: fact.canonical || fact.label,
                              amount:
                                fact.amount == null ? "" : String(fact.amount),
                              unit: fact.unit || "",
                            });
                          }}
                        >
                          Fix
                        </Button>
                        {needsReview ? (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => review(fact, "reject")}
                            disabled={saving === fact.id}
                          >
                            Ignore
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {editing ? (
                    <div className="mt-3 grid gap-2 border-t border-amber-300 pt-3 dark:border-amber-800 sm:grid-cols-[1fr_110px_90px_auto]">
                      <input
                        aria-label="Fact label"
                        value={draft.label}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            label: e.target.value,
                          }))
                        }
                        className="h-9 border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                      />
                      <input
                        aria-label="Fact amount"
                        inputMode="decimal"
                        value={draft.amount}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            amount: e.target.value,
                          }))
                        }
                        className="h-9 border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                        placeholder="Value"
                      />
                      <input
                        aria-label="Fact unit"
                        value={draft.unit}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            unit: e.target.value,
                          }))
                        }
                        className="h-9 border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                        placeholder="Unit"
                      />
                      <Button
                        size="xs"
                        onClick={() => review(fact, "edit")}
                        disabled={saving === fact.id}
                      >
                        Save
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : entry.processingStatus === "processing" ||
          entry.processingStatus === "queued" ? (
          <div className="mt-4 h-8 animate-pulse border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" />
        ) : null}

        {entry.processingStatus === "failed" ? (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-red-200 pt-3 dark:border-red-900">
            <p className="text-xs text-red-700 dark:text-red-300">
              The original is safe. Only the reading step failed.
            </p>
            <Button
              size="xs"
              variant="ghost"
              onClick={retry}
              disabled={saving === entry.id}
            >
              Retry
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
