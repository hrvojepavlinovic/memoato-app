import React from "react";
import {
  createRawLog,
  getMemoryOverview,
  queryClientInitialized,
  useQuery,
} from "wasp/client/operations";
import { Button, ButtonLink } from "../../shared/components/Button";
import { usePrivacy } from "../../privacy/PrivacyProvider";

function timeOnly(value: string | Date): string {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function compactFact(fact: any): string {
  const name = fact.canonical || fact.label;
  if (typeof fact.amount === "number")
    return `${name} · ${Number.isInteger(fact.amount) ? fact.amount : fact.amount.toFixed(1)}${fact.unit ? ` ${fact.unit}` : ""}`;
  return name;
}

function compactEntryLabel(entry: any): string {
  const primary = entry?.primaryLabel;
  const fact = (entry?.facts ?? []).find(
    (candidate: any) =>
      candidate?.conceptKey && candidate.conceptKey === primary?.conceptKey,
  );
  if (fact && typeof fact.amount === "number") return compactFact(fact);
  if (primary?.label) {
    const domain = String(primary.domain || "personal").replace(/-/g, " ");
    return `${domain} · ${primary.label}`;
  }
  return entry?.processingStatus === "complete"
    ? "Life note"
    : entry?.processingStatus;
}

export function TodayMemoryPanel({
  onOpenLegacyCapture,
}: {
  onOpenLegacyCapture: () => void;
}) {
  const privacy = usePrivacy();
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const overview = useQuery(getMemoryOverview, undefined, {
    enabled: privacy.mode === "cloud",
    refetchInterval: privacy.mode === "cloud" ? 5_000 : false,
  });
  const data = overview.data as any;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const raw = text.trim();
    if (!raw || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      await createRawLog({ text: raw });
      setText("");
      setSaved(true);
      const queryClient = await queryClientInitialized;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["operations/get-memory-overview"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["operations/get-memory-feed"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["operations/get-categories"],
        }),
      ]);
      globalThis.setTimeout(() => {
        void overview.refetch();
      }, 1_500);
    } finally {
      setSaving(false);
    }
  }

  if (privacy.mode !== "cloud") {
    return (
      <section className="mb-7 grid gap-4 border border-neutral-300 bg-[#fbfaf7] p-5 dark:border-neutral-700 dark:bg-[#181816] sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <div className="label">
            {privacy.mode === "local" ? "Local capture" : "Encrypted capture"}
          </div>
          <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            {privacy.mode === "local"
              ? "This stays on this device. Memoato will not send it to OpenRouter."
              : "Encrypted notes keep their current flow and are never sent to OpenRouter."}
          </p>
        </div>
        <Button onClick={onOpenLegacyCapture}>Capture privately</Button>
      </section>
    );
  }

  return (
    <section className="mb-7 grid overflow-hidden border-2 border-neutral-950 bg-[#fbfaf7] dark:border-neutral-100 dark:bg-[#181816] lg:grid-cols-[1.35fr_0.65fr]">
      <form onSubmit={submit} className="p-4 sm:p-5">
        <label htmlFor="memoato-today-capture" className="label">
          Raw entry
        </label>
        <textarea
          id="memoato-today-capture"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setSaved(false);
          }}
          placeholder="e.g. Football at Karepovac, felt sharp after a slow morning…"
          className="mt-3 min-h-28 w-full resize-y border-0 bg-transparent p-0 text-lg font-medium leading-7 tracking-[-0.02em] outline-none placeholder:text-neutral-400 sm:text-xl"
          maxLength={4000}
        />
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-neutral-300 pt-3 dark:border-neutral-700">
          <div className="min-w-0 text-xs font-medium text-neutral-500">
            {saved ? (
              <span className="text-emerald-700 dark:text-emerald-400">
                Original saved. Reading in background.
              </span>
            ) : (
              "Write naturally. Facts remain editable."
            )}
          </div>
          <Button
            type="submit"
            disabled={!text.trim() || saving}
            className="min-w-28"
          >
            {saving ? "Saving…" : "Remember"}
          </Button>
        </div>
      </form>

      <div className="border-t border-neutral-950 bg-neutral-950 p-4 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950 sm:p-5 lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-neutral-400 dark:text-neutral-600">
            Recent memory
          </div>
          <ButtonLink
            to="/memory"
            size="xs"
            variant="ghost"
            className="!border-neutral-700 !text-white hover:!border-white hover:!bg-neutral-900 hover:!text-white dark:!border-neutral-300 dark:!text-neutral-950 dark:hover:!border-neutral-950 dark:hover:!bg-neutral-200 dark:hover:!text-neutral-950"
          >
            Open
          </ButtonLink>
        </div>
        <div className="mt-4 space-y-4">
          {(data?.recent ?? []).slice(0, 2).map((entry: any) => (
            <div
              key={entry.id}
              className="border-l border-neutral-700 pl-3 dark:border-neutral-300"
            >
              <div className="line-clamp-2 text-sm font-semibold leading-5">
                {entry.rawText}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-400 dark:text-neutral-600">
                <span>{timeOnly(entry.occurredAt)}</span>
                <span>/</span>
                <span className="truncate">{compactEntryLabel(entry)}</span>
              </div>
            </div>
          ))}
          {(data?.recent ?? []).length === 0 ? (
            <p className="text-sm leading-6 text-neutral-400 dark:text-neutral-600">
              Your originals will collect here without asking you to organize
              first.
            </p>
          ) : null}
        </div>
        <div className="mt-5 grid grid-cols-2 border-t border-neutral-700 pt-4 dark:border-neutral-300">
          <div>
            <div className="text-xl font-semibold tabular-nums">
              {data?.capturedToday ?? 0}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-400 dark:text-neutral-600">
              Today
            </div>
          </div>
          <div className="border-l border-neutral-700 pl-4 dark:border-neutral-300">
            <div className="text-xl font-semibold tabular-nums">
              {data?.reviewCount ?? 0}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-400 dark:text-neutral-600">
              To review
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
