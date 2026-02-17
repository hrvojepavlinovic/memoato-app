import React from "react";
import { createEvent, queryClientInitialized } from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { Dialog } from "../../shared/components/Dialog";
import { usePrivacy } from "../../privacy/PrivacyProvider";
import { encryptUtf8ToEncryptedString } from "../../privacy/crypto";
import { parseNumberInput } from "../../shared/lib/parseNumberInput";
import { localCreateEvent } from "../local";
import type { CategoryWithStats } from "../types";

function unitLabel(unit: unknown): string | null {
  if (typeof unit !== "string") return null;
  const u = unit.trim();
  if (!u || u === "x") return null;
  return u;
}

export function QuickAddDialog({
  open,
  onClose,
  category,
  displayTitle,
  accentHex,
}: {
  open: boolean;
  onClose: () => void;
  category: CategoryWithStats | null;
  displayTitle: string | null;
  accentHex: string;
}) {
  const privacy = usePrivacy();
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const isNotes = (category?.slug ?? "") === "notes";
  const isWeight = category?.chartType === "line";
  const isCountType = category?.categoryType === "DO" || category?.categoryType === "DONT";
  const unit = unitLabel(category?.unit);
  const amountPlaceholder = isWeight ? "e.g. 84.5" : isCountType ? "e.g. 1" : "e.g. 20";

  React.useEffect(() => {
    if (!open) return;
    setAmount("");
    setNote("");
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  async function invalidateHomeStats(): Promise<void> {
    if (privacy.mode === "local") return;
    const queryClient = await queryClientInitialized;
    await queryClient.invalidateQueries({ queryKey: ["operations/get-categories"] });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category?.id) return;

    const n = isNotes ? 1 : parseNumberInput(amount);
    if (!isNotes && (n == null || n <= 0)) {
      window.alert("Enter a positive number.");
      return;
    }
    if (isNotes && note.trim().length === 0) {
      window.alert("Write a note first.");
      return;
    }

    setSaving(true);
    try {
      if (privacy.mode === "local") {
        if (!privacy.userId) return;
        await localCreateEvent({
          userId: privacy.userId,
          categoryId: category.id,
          amount: n ?? 1,
          rawText: isNotes ? note : amount.trim() || null,
          ...(isNotes ? { note } : {}),
        });
      } else if (isNotes && privacy.mode === "encrypted") {
        if (!privacy.key || !privacy.cryptoParams) {
          window.alert("Unlock encryption from Profile → Privacy first.");
          return;
        }
        const noteEnc = await encryptUtf8ToEncryptedString(privacy.key as CryptoKey, privacy.cryptoParams, note.trim());
        await createEvent({ categoryId: category.id, amount: 1, noteEnc, rawText: null } as any);
      } else {
        await createEvent({
          categoryId: category.id,
          amount: n ?? 1,
          ...(isNotes ? { note } : {}),
          ...(privacy.mode === "encrypted" ? {} : { rawText: isNotes ? note : amount.trim() || null }),
        } as any);
      }

      await invalidateHomeStats();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="mx-auto mt-[18vh] w-[92vw] max-w-md">
        <div className="card p-4 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full border bg-white dark:bg-neutral-950"
                style={{ borderColor: accentHex }}
                aria-hidden="true"
              >
                <div className="text-lg leading-none">{category?.emoji ?? ""}</div>
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-neutral-950 dark:text-neutral-100">
                  {displayTitle ?? "Quick add"}
                </div>
                {unit ? (
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Unit: {unit}
                  </div>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
              aria-label="Close"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={onSubmit} className="mt-4 grid gap-3">
            {isNotes ? (
              <textarea
                ref={inputRef as any}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Write a note…"
                className="block w-full min-w-0 max-w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                rows={4}
                disabled={saving}
              />
            ) : (
              <div className="relative">
                <input
                  ref={inputRef as any}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={amountPlaceholder}
                  inputMode="decimal"
                  className="block h-11 w-full min-w-0 max-w-full rounded-lg border border-neutral-300 bg-white px-3 pr-14 text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  disabled={saving}
                />
                {unit ? (
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                    {unit}
                  </div>
                ) : null}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" className="h-11" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button className="h-11" type="submit" disabled={saving}>
                Add
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Dialog>
  );
}
