import React from "react";
import { createEvent, getCategoryEvents, queryClientInitialized, useQuery } from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { Dialog } from "../../shared/components/Dialog";
import { usePrivacy } from "../../privacy/PrivacyProvider";
import { encryptUtf8ToEncryptedString } from "../../privacy/crypto";
import { parseNumberInput } from "../../shared/lib/parseNumberInput";
import { resolveAccentForTheme } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { localCreateEvent, localGetCategoryEvents } from "../local";
import type { CategoryWithStats } from "../types";

function formatValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function normalizeText(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  const n = normalizeText(s);
  if (!n) return [];
  return n.split(" ").filter(Boolean);
}

function isNotesCategory(c: CategoryWithStats): boolean {
  return (c.slug ?? "").trim().toLowerCase() === "notes";
}

function unitLabel(unit: unknown): string | null {
  if (typeof unit !== "string") return null;
  const u = unit.trim();
  if (!u || u === "x") return null;
  return u;
}

function categoryKey(c: CategoryWithStats, displayTitle: string): string | null {
  const t = normalizeText(displayTitle);
  const s = normalizeText(c.slug ?? "");
  const u = normalizeText(c.unit ?? "");

  if (t.includes("weight") || t.includes("tezina") || t.includes("težina") || u === "kg") return "weight";
  if (t.includes("water") || t.includes("voda") || u === "ml" || u === "l") return "water";
  if (t.includes("push") || t.includes("sklek")) return "pushups";
  if (t.includes("pull") || t.includes("zgib")) return "pullups";
  if (t.includes("bike") || t.includes("bicikl") || t.includes("spinning") || t.includes("cycle") || s.includes("bike"))
    return "bike";
  if (t.includes("padel") || s.includes("padel")) return "padel";
  if (t.includes("football") || t.includes("nogomet") || s.includes("football")) return "football";
  if (u === "kcal" || t.includes("kcal") || t.includes("calorie")) return "kcal";

  return null;
}

const KEY_ALIASES: Record<string, string[]> = {
  weight: ["weight", "tezina", "težina", "vaga", "kg"],
  water: ["water", "voda", "ml", "l", "litre", "litra"],
  pushups: ["push", "pushup", "pushups", "sklek", "sklekovi", "skleki"],
  pullups: ["pull", "pullup", "pullups", "zgib", "zgibovi"],
  bike: ["bike", "bicikl", "cycle", "spinning", "indoor"],
  padel: ["padel"],
  football: ["football", "nogomet", "futsal"],
  kcal: ["kcal", "cal", "calorie", "calories"],
};

type ParsedQuickLog = {
  amount: number | null;
  hint: string;
  raw: string;
};

function parseQuickLogInput(raw: string): ParsedQuickLog {
  const s = raw.trim();
  if (!s) return { amount: null, hint: "", raw };

  // number first: "30 push ups"
  const m1 = s.match(/^([+-]?\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (m1) {
    const amount = parseNumberInput(m1[1]);
    const hint = (m1[2] ?? "").trim();
    if (amount != null) return { amount, hint, raw };
  }

  // number last: "push ups 30"
  const m2 = s.match(/^(.*\S)\s+([+-]?\d+(?:[.,]\d+)?)$/);
  if (m2) {
    const amount = parseNumberInput(m2[2]);
    const hint = (m2[1] ?? "").trim();
    if (amount != null) return { amount, hint, raw };
  }

  return { amount: null, hint: s, raw };
}

function replaceAmountInRaw(raw: string, nextAmount: number): string {
  const s = raw.trim();
  const next = formatValue(nextAmount);
  if (!s) return next;

  const m1 = s.match(/^([+-]?\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (m1) {
    const parsed = parseNumberInput(m1[1]);
    if (parsed != null) {
      const rest = (m1[2] ?? "").trim();
      return rest ? `${next} ${rest}` : next;
    }
  }

  const m2 = s.match(/^(.*\S)\s+([+-]?\d+(?:[.,]\d+)?)$/);
  if (m2) {
    const parsed = parseNumberInput(m2[2]);
    if (parsed != null) {
      const rest = (m2[1] ?? "").trim();
      return rest ? `${rest} ${next}` : next;
    }
  }

  return `${s} ${next}`.trim();
}

function timeFitScore(nowMinute: number, typicalMinute: number): number {
  const diff = Math.abs(nowMinute - typicalMinute);
  // Within ~3h should still feel plausible.
  const sigma = 3 * 60;
  const s = Math.exp(-Math.pow(diff / sigma, 2));
  return clamp01(s);
}

function relativeDiff(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(1, Math.abs(b));
}

function relativeCloseness(a: number, b: number): number {
  const d = relativeDiff(a, b);
  // d=0   -> 1.00
  // d=0.5 -> ~0.74
  // d=1.0 -> ~0.36
  return clamp01(Math.exp(-Math.pow(d / 0.85, 2)));
}

function amountFitScore(args: {
  c: CategoryWithStats;
  displayTitle: string;
  amount: number;
  key: string | null;
}): number {
  const { c, displayTitle, amount, key } = args;
  if (amount <= 0) return 0;

  const u = normalizeText(c.unit ?? "");
  const title = normalizeText(displayTitle);
  const isDecimal = !Number.isInteger(amount);

  const last = c.recentLastAmount30d ?? (c.chartType === "line" ? c.lastValue : null);
  const avg = c.recentAvgAmount30d;
  const typical = c.goalWeekly != null && c.goalWeekly > 0 ? c.goalWeekly / 7 : null;

  let closeness = 0;
  if (last != null) closeness = Math.max(closeness, relativeCloseness(amount, last));
  if (avg != null) closeness = Math.max(closeness, relativeCloseness(amount, avg));
  if (typical != null) closeness = Math.max(closeness, relativeCloseness(amount, typical) * 0.85);

  if (closeness > 0) {
    const decimalBoost = isDecimal ? 0.12 : 0;
    const weightBoost = key === "weight" || u === "kg" || title.includes("weight") ? 0.1 : 0;
    const unitBoost = u === "ml" || u === "l" || u === "kcal" ? 0.1 : 0;
    return clamp01(closeness + decimalBoost + weightBoost + unitBoost);
  }

  // Binary/session categories.
  if (amount === 1) {
    if (key === "padel" || key === "football") return 0.9;
    if (c.categoryType === "DO" || c.categoryType === "DONT") return 0.75;
  }

  // Weight is very often an integer like "95".
  if (key === "weight" || u === "kg" || title.includes("weight") || title.includes("tezina") || title.includes("težina")) {
    if (amount >= 20 && amount <= 250) return isDecimal ? 0.85 : 0.78;
  }

  // Unit hints.
  if ((u === "ml" || u === "l") && amount >= 50 && amount <= 3000) return 0.65;
  if (u === "kcal" && amount >= 50 && amount <= 4000) return 0.55;

  // Fallback: smaller amounts are usually reps.
  if (amount <= 300) return 0.35;
  return 0.2;
}

function textMatchScore(args: {
  c: CategoryWithStats;
  displayTitle: string;
  hint: string;
}): number {
  const { c, displayTitle, hint } = args;
  const tokens = tokenize(hint);
  if (tokens.length === 0) return 0;

  const title = normalizeText(displayTitle);
  const slug = normalizeText(c.slug ?? "");
  const unit = normalizeText(c.unit ?? "");
  const key = categoryKey(c, displayTitle);
  const aliases = (key && KEY_ALIASES[key]) || [];

  const hay = [title, slug, unit, ...aliases].join(" ");

  let hits = 0;
  for (const t of tokens) {
    if (t.length <= 1) continue;
    if (hay.includes(t)) hits += 1;
  }
  const frac = hits / Math.max(1, tokens.length);

  // Extra boost if the whole hint is a substring of title/slug.
  const whole = normalizeText(hint);
  const wholeBoost = whole && (title.includes(whole) || slug.includes(whole)) ? 0.35 : 0;

  return clamp01(frac * 0.8 + wholeBoost);
}

function alreadyLoggedPenalty(c: CategoryWithStats): number {
  const todayCount = c.todayCount ?? 0;
  if (todayCount <= 0) return 0;

  // If the category is often logged multiple times per day, don't penalize.
  const avgPerDay = c.recentAvgEventsPerDay30d ?? 0;
  if (avgPerDay >= 1.5) return 0.1;

  // For value-type categories, suggesting again today is usually wrong.
  if (c.chartType === "line") return 0.7;

  return 0.35;
}

function defaultSuggestScore(c: CategoryWithStats, displayTitle: string, nowMinute: number): number {
  // Similar to "Next up" but simplified. Used when input is empty.
  if (isNotesCategory(c)) return 0;

  const key = categoryKey(c, displayTitle);
  if (c.chartType === "line") {
    if (c.goalValue == null || c.lastValue == null) return 0;
  } else {
    if (c.goalWeekly == null || c.goalWeekly <= 0) return 0;
  }

  const typicalMinute = c.recentAvgMinuteOfDay30d ?? 12 * 60;
  const due = timeFitScore(nowMinute, typicalMinute);

  let remaining = 0;
  if (c.chartType === "line") {
    if (c.goalValue != null && c.lastValue != null) {
      remaining = Math.abs(c.goalValue - c.lastValue) / Math.max(1, Math.abs(c.goalValue));
    }
  } else if (c.goalWeekly != null && c.goalWeekly > 0) {
    remaining = Math.max(0, (c.goalWeekly - c.thisWeekTotal) / Math.max(1, c.goalWeekly));
  }

  const keyPenalty = key === "kcal" ? 0.05 : 0;
  const loggedPenalty = alreadyLoggedPenalty(c);
  return clamp01(due * 0.55 + remaining * 0.45 - keyPenalty - loggedPenalty);
}

type RankedCandidate = {
  c: CategoryWithStats;
  displayTitle: string;
  accent: string;
  score: number;
};

function rankCategories(args: {
  categories: CategoryWithStats[];
  displayTitleById: Record<string, string>;
  themeIsDark: boolean;
  nowMinute: number;
  parsed: ParsedQuickLog;
}): RankedCandidate[] {
  const { categories, displayTitleById, themeIsDark, nowMinute, parsed } = args;
  const { amount, hint } = parsed;

  return categories
    .filter((c) => !c.isSystem || isNotesCategory(c))
    .map((c) => {
      const displayTitle = displayTitleById[c.id] ?? c.title;
      const accent = resolveAccentForTheme(c.accentHex, themeIsDark) ?? c.accentHex;
      const key = categoryKey(c, displayTitle);

      const tScore = hint ? textMatchScore({ c, displayTitle, hint }) : 0;
      const aScore = amount != null ? amountFitScore({ c, displayTitle, amount, key }) : 0;
      const timeScore = timeFitScore(nowMinute, c.recentAvgMinuteOfDay30d ?? 12 * 60);
      const loggedPenalty = alreadyLoggedPenalty(c);

      let score = 0;
      if (!hint && amount == null) {
        score = defaultSuggestScore(c, displayTitle, nowMinute);
      } else if (hint && amount == null) {
        // Text only is usually category selection or Notes.
        const notesBoost = isNotesCategory(c) ? 0.55 : 0;
        score = clamp01(tScore * 0.85 + timeScore * 0.15 + notesBoost - loggedPenalty);
      } else if (!hint && amount != null) {
        // Number only.
        const notesPenalty = isNotesCategory(c) ? 0.45 : 0;
        score = clamp01(aScore * 0.75 + timeScore * 0.25 - notesPenalty - loggedPenalty);
      } else {
        // Both number and hint.
        const notesPenalty = isNotesCategory(c) ? 0.7 : 0;
        score = clamp01(tScore * 0.65 + aScore * 0.25 + timeScore * 0.1 - notesPenalty - loggedPenalty);
      }

      return { c, displayTitle, accent, score };
    })
    .sort((a, b) => b.score - a.score || a.displayTitle.localeCompare(b.displayTitle));
}

function amountFromParsedOrDefault(parsed: ParsedQuickLog, c: CategoryWithStats, displayTitle: string): number | null {
  if (parsed.amount != null) return parsed.amount;
  if (isNotesCategory(c)) return 1;
  if (c.categoryType === "DO" || c.categoryType === "DONT") return 1;
  const key = categoryKey(c, displayTitle);
  if (key === "padel" || key === "football") return 1;
  return null;
}

function useIsMobileSm(): boolean {
  const [isMobile, setIsMobile] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 639px)").matches;
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

export function QuickLogDialog({
  open,
  onClose,
  categories,
  displayTitleById,
  seedCategoryId,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryWithStats[];
  displayTitleById: Record<string, string>;
  seedCategoryId: string | null;
}) {
  const privacy = usePrivacy();
  const theme = useTheme();
  const [raw, setRaw] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(null);
  const [selectionMode, setSelectionMode] = React.useState<"seed" | "auto" | "manual">("auto");
  const [showPicker, setShowPicker] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isMobile = useIsMobileSm();
  const [mobileViewport, setMobileViewport] = React.useState<{ height: number; top: number }>({ height: 0, top: 0 });

  const now = new Date();
  const nowMinute = now.getHours() * 60 + now.getMinutes();
  const parsed = React.useMemo(() => parseQuickLogInput(raw), [raw]);
  const ranked = React.useMemo(
    () =>
      rankCategories({
        categories,
        displayTitleById,
        themeIsDark: theme.isDark,
        nowMinute,
        parsed,
      }),
    [categories, displayTitleById, nowMinute, parsed, theme.isDark]
  );

  const selected = React.useMemo(() => {
    if (!selectedCategoryId) return null;
    return categories.find((c) => c.id === selectedCategoryId) ?? null;
  }, [categories, selectedCategoryId]);

  const selectedDisplayTitle = selected ? displayTitleById[selected.id] ?? selected.title : null;
  const selectedAccent =
    selected && selected.accentHex ? resolveAccentForTheme(selected.accentHex, theme.isDark) ?? selected.accentHex : "#0A0A0A";
  const selectedIsNotes = selected ? isNotesCategory(selected) : false;
  const selectedUnit = unitLabel(selected?.unit);

  const recentRemoteQuery = useQuery(
    getCategoryEvents,
    selected?.id ? { categoryId: selected.id, take: 5 } : (undefined as any),
    { enabled: open && privacy.mode !== "local" && !!selected?.id && !selectedIsNotes }
  );

  const [recentLocal, setRecentLocal] = React.useState<{ last: number | null; avg5: number | null }>({
    last: null,
    avg5: null,
  });

  React.useEffect(() => {
    if (!open) return;
    if (privacy.mode !== "local") return;
    if (!privacy.userId) return;
    if (!selected?.id || selectedIsNotes) return;
    let cancelled = false;
    localGetCategoryEvents({ userId: privacy.userId, categoryId: selected.id, take: 5 }).then((items) => {
      if (cancelled) return;
      const amounts = items.map((e) => e.amount).filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0);
      const last = amounts[0] ?? null;
      const avg5 = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : null;
      setRecentLocal({ last, avg5 });
    });
    return () => {
      cancelled = true;
    };
  }, [open, privacy.mode, privacy.userId, selected?.id, selectedIsNotes]);

  const recent = React.useMemo(() => {
    if (!open || !selected?.id || selectedIsNotes) return { last: null as number | null, avg5: null as number | null };
    if (privacy.mode === "local") return recentLocal;
    const items = recentRemoteQuery.data ?? [];
    const amounts = items.map((e) => e.amount).filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0);
    const last = amounts[0] ?? null;
    const avg5 = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : null;
    return { last, avg5 };
  }, [open, privacy.mode, recentLocal, recentRemoteQuery.data, selected?.id, selectedIsNotes]);

  React.useEffect(() => {
    if (!open) return;
    setRaw("");
    setSaving(false);
    setShowPicker(false);
    setSelectionMode(seedCategoryId ? "seed" : "auto");
    setSelectedCategoryId(seedCategoryId);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, seedCategoryId]);

  React.useLayoutEffect(() => {
    if (!open) return;
    if (!isMobile) return;

    const vv = window.visualViewport ?? null;
    const update = () => {
      const height = vv?.height ?? window.innerHeight;
      const top = vv?.offsetTop ?? 0;
      setMobileViewport({ height: Math.round(height), top: Math.round(top) });
    };

    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [open, isMobile]);

  React.useEffect(() => {
    if (!open) return;
    if (selectionMode === "manual") return;
    if (seedCategoryId && selectionMode === "seed") return;
    const top = ranked[0];
    if (!top) return;

    const hasTyped = raw.trim().length > 0;
    if (!selectedCategoryId) {
      if (hasTyped || top.score > 0.12) setSelectedCategoryId(top.c.id);
      return;
    }

    const current = ranked.find((r) => r.c.id === selectedCategoryId);
    const currentScore = current?.score ?? 0;
    if (top.c.id !== selectedCategoryId && top.score - currentScore >= 0.12 && (hasTyped || top.score > 0.62)) {
      setSelectedCategoryId(top.c.id);
    }
  }, [open, ranked, raw, seedCategoryId, selectedCategoryId, selectionMode]);

  const chips = React.useMemo(() => {
    const filtered = selectedCategoryId ? ranked.filter((r) => r.c.id !== selectedCategoryId) : ranked;
    return filtered.slice(0, 2);
  }, [ranked, selectedCategoryId]);
  const listMore = ranked.slice(0, 12);

  function togglePicker(next?: boolean) {
    const willShow = typeof next === "boolean" ? next : !showPicker;
    setShowPicker(willShow);
    if (willShow) {
      // Better mobile UX: hide keyboard so the list has space.
      inputRef.current?.blur();
      window.setTimeout(() => {
        const el = document.getElementById("memoato-quicklog-pick");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    } else {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  const subtitle = React.useMemo(() => {
    if (!selected) return "";
    if (selectedIsNotes) return "Notes";
    if (selected.chartType === "line" && selected.goalValue != null && selected.lastValue != null) {
      const unit = selectedUnit ? ` ${selectedUnit}` : "";
      return `${formatValue(selected.lastValue)}${unit} last`;
    }
    if (selected.goalWeekly != null && selected.goalWeekly > 0) {
      const unit = selectedUnit ? ` ${selectedUnit}` : "";
      return `${formatValue(selected.thisWeekTotal)}/${formatValue(selected.goalWeekly)}${unit} this week`;
    }
    if ((selected.slug ?? "").toLowerCase() === "notes") {
      return "Notes";
    }
    const unit = selectedUnit ? ` ${selectedUnit}` : "";
    return `${formatValue(selected.thisWeekTotal)}${unit} this week`;
  }, [selected, selectedIsNotes, selectedUnit]);

  async function invalidateHomeStats(): Promise<void> {
    if (privacy.mode === "local") return;
    const queryClient = await queryClientInitialized;
    await queryClient.invalidateQueries({ queryKey: ["operations/get-categories"] });
  }

  async function submit(): Promise<void> {
    if (!selected) return;

    const displayTitle = selectedDisplayTitle ?? selected.title;
    const isNotes = selectedIsNotes;
    const amount = amountFromParsedOrDefault(parsed, selected, displayTitle);
    const noteText = parsed.hint.trim().length > 0 ? parsed.hint.trim() : parsed.raw.trim();

    if (!isNotes) {
      if (amount == null || amount <= 0) {
        window.alert(`Enter a number for ${displayTitle}.`);
        return;
      }
    } else {
      if (noteText.length === 0) {
        window.alert("Write a note first.");
        return;
      }
    }

    setSaving(true);
    try {
      if (privacy.mode === "local") {
        if (!privacy.userId) return;
        await localCreateEvent({
          userId: privacy.userId,
          categoryId: selected.id,
          amount: amount ?? 1,
          ...(isNotes ? { note: noteText } : {}),
        });
      } else if (isNotes && privacy.mode === "encrypted") {
        if (!privacy.key || !privacy.cryptoParams) {
          window.alert("Unlock encryption from Profile → Privacy first.");
          return;
        }
        const noteEnc = await encryptUtf8ToEncryptedString(privacy.key as CryptoKey, privacy.cryptoParams, noteText);
        await createEvent({ categoryId: selected.id, amount: 1, noteEnc } as any);
      } else {
        await createEvent({ categoryId: selected.id, amount: amount ?? 1, ...(isNotes ? { note: noteText } : {}) } as any);
      }

      await invalidateHomeStats();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function onChipPick(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setSelectionMode("manual");
  }

  function setQuickAmount(n: number) {
    setRaw((prev) => replaceAmountInRaw(prev, n));
    inputRef.current?.focus();
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div
        className={
          "w-full bg-white dark:bg-neutral-950 sm:bg-transparent " + (isMobile ? "fixed left-0 right-0 z-50" : "h-auto")
        }
        style={isMobile && mobileViewport.height > 0 ? { top: mobileViewport.top, height: mobileViewport.height } : undefined}
      >
        <div className="mx-auto h-full w-full max-w-lg sm:mt-[14vh] sm:h-auto sm:w-[92vw]">
          <div className="card flex h-full flex-col overflow-hidden shadow-lg sm:h-auto sm:rounded-2xl">
            <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90 sm:rounded-t-2xl">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-neutral-950 dark:text-neutral-100">Quick log</div>
                  <div className="mt-0.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Type a number, a category, or a note.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                  aria-label="Close"
                  disabled={saving}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M18 6 6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-28 pt-4 sm:p-4">
              <div className="flex flex-wrap gap-2">
              {chips.map((r) => {
                const active = r.c.id === selectedCategoryId;
                return (
                  <button
                    key={r.c.id}
                    type="button"
                    onClick={() => onChipPick(r.c.id)}
                    className={
                      "inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold shadow-sm " +
                      (active
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950"
                        : "border-neutral-200 bg-white text-neutral-950 hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900 dark:active:bg-neutral-800")
                    }
                    title={r.displayTitle}
                    disabled={saving}
                  >
                    <span className="text-base leading-none" aria-hidden="true">
                      {r.c.emoji ?? ""}
                    </span>
                    <span className="max-w-[14rem] truncate">{r.displayTitle}</span>
                  </button>
                );
              })}
              </div>
              {!selected && ranked.length > 0 ? (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => togglePicker(true)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                    disabled={saving}
                  >
                    Pick category
                  </button>
                </div>
              ) : null}

              {selected ? (
                <div
                  className="mt-3 rounded-xl border bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"
                  style={{ borderColor: selectedAccent }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-9 w-9 flex-none items-center justify-center rounded-full border bg-white dark:bg-neutral-950"
                        style={{ borderColor: selectedAccent }}
                        aria-hidden="true"
                      >
                        <div className="text-lg leading-none">{selected.emoji ?? ""}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-neutral-950 dark:text-neutral-100">
                          {selectedDisplayTitle ?? selected.title}
                        </div>
                        <div className="truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">{subtitle}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex h-10 flex-none items-center gap-2 rounded-full border bg-white px-3 text-sm font-semibold text-neutral-950 shadow-sm hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900 dark:active:bg-neutral-800"
                        style={{ borderColor: selectedAccent }}
                        aria-label="Change category"
                        title="Change category"
                        onClick={() => togglePicker(true)}
                        disabled={saving}
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M21 12a9 9 0 1 1-3-6.7" />
                          <path d="M21 3v6h-6" />
                        </svg>
                        <span>Change</span>
                      </button>
                    </div>
                  </div>

                  {!selectedIsNotes && (recent.last != null || recent.avg5 != null || (selected.goalWeekly ?? 0) > 0) ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {recent.last != null ? (
                        <button
                          type="button"
                          className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-950 hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900 dark:active:bg-neutral-800"
                          onClick={() => setQuickAmount(recent.last!)}
                          disabled={saving}
                          title="Use last value"
                        >
                          Last {formatValue(recent.last)}
                        </button>
                      ) : null}
                      {recent.avg5 != null ? (
                        <button
                          type="button"
                          className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-950 hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900 dark:active:bg-neutral-800"
                          onClick={() => setQuickAmount(recent.avg5!)}
                          disabled={saving}
                          title="Use average of recent values"
                        >
                          Avg {formatValue(recent.avg5)}
                        </button>
                      ) : null}
                      {(() => {
                        const goalWeekly = selected.goalWeekly;
                        if (goalWeekly == null || goalWeekly <= 0) return null;
                        return (
                          <button
                            type="button"
                            className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-950 hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900 dark:active:bg-neutral-800"
                            onClick={() => setQuickAmount(goalWeekly / 7)}
                            disabled={saving}
                            title="Use a daily split of your weekly goal"
                          >
                            {formatValue(goalWeekly / 7)} goal
                          </button>
                        );
                      })()}
                    </div>
                  ) : null}
                </div>
              ) : null}

            {showPicker ? (
              <div id="memoato-quicklog-pick" className="pt-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Pick category</div>
                  <button
                    type="button"
                    onClick={() => togglePicker(false)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                    disabled={saving}
                  >
                    Hide
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {listMore.map((r) => {
                    const active = r.c.id === selectedCategoryId;
                    return (
                      <button
                        key={r.c.id}
                        type="button"
                        className={
                          "flex w-full items-center gap-3 rounded-xl border p-3 text-left " +
                          (active
                            ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950"
                            : "border-neutral-200 bg-white text-neutral-950 hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900 dark:active:bg-neutral-800")
                        }
                        onClick={() => {
                          onChipPick(r.c.id);
                          togglePicker(false);
                        }}
                        disabled={saving}
                        title={r.displayTitle}
                      >
                        <div
                          className={
                            "flex h-9 w-9 flex-none items-center justify-center rounded-full border " +
                            (active ? "border-white/40 bg-white/10 dark:border-neutral-950/20 dark:bg-neutral-950/10" : "bg-white dark:bg-neutral-950")
                          }
                          style={{ borderColor: active ? undefined : r.accent }}
                          aria-hidden="true"
                        >
                          <div className="text-lg leading-none">{r.c.emoji ?? ""}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{r.displayTitle}</div>
                          <div
                            className={
                              "truncate text-xs font-medium " +
                              (active ? "text-white/80 dark:text-neutral-700" : "text-neutral-500 dark:text-neutral-400")
                            }
                          >
                            {r.score >= 0.62 ? "Suggested" : "Option"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            </div>

            <div className="border-t border-neutral-200 bg-white/90 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90 sm:rounded-b-2xl">
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <input
                    ref={inputRef}
                    value={raw}
                    onChange={(e) => {
                      setRaw(e.target.value);
                      if (selectionMode === "seed") setSelectionMode("auto");
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      if (saving) return;
                      submit();
                    }}
                    placeholder="e.g. 600 water, push ups 30, or just a note"
                    className="block h-12 w-full min-w-0 max-w-full rounded-xl border border-neutral-300 bg-white px-3 pr-20 text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                    disabled={saving}
                  />
                  {selectedUnit && !selectedIsNotes ? (
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                      {selectedUnit}
                    </div>
                  ) : null}
                </div>
                <Button
                  className="h-12 flex-none px-5"
                  onClick={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                  disabled={saving || !selectedCategoryId}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
