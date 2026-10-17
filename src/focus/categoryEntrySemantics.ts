export type CategoryType = "NUMBER" | "DO" | "DONT" | "GOAL";

export function isBinaryCategoryType(
  categoryType: CategoryType | null | undefined,
): boolean {
  return categoryType === "DO" || categoryType === "DONT";
}

export function isPlayedSessionCategory(
  categorySlug: string | null | undefined,
): boolean {
  const slug = String(categorySlug ?? "")
    .trim()
    .toLowerCase();
  return slug === "football" || slug === "padel";
}

export function normalizeCategoryAmount(args: {
  categoryType: CategoryType | null | undefined;
  requestedAmount: number | null;
  scheduledStatus?: string | null;
}): number | null {
  if (!isBinaryCategoryType(args.categoryType)) return args.requestedAmount;
  const status = String(args.scheduledStatus ?? "")
    .trim()
    .toLowerCase();
  return status === "missed" || status === "cancelled" ? 0 : 1;
}

export function categoryEntryLabel(args: {
  categorySlug?: string | null;
  categoryTitle?: string | null;
  scheduledStatus?: string | null;
  amount?: number | null;
}): string {
  const slug = String(args.categorySlug ?? "")
    .trim()
    .toLowerCase();
  const title = String(args.categoryTitle ?? "entry").trim() || "entry";
  const status = String(args.scheduledStatus ?? "")
    .trim()
    .toLowerCase();
  const positive = typeof args.amount !== "number" || args.amount > 0;

  if (isPlayedSessionCategory(slug)) {
    const sport = slug === "football" ? "football" : "padel";
    if (status === "cancelled") return `Cancelled ${sport}`;
    if (status === "missed" || !positive) return `Didn’t play ${sport}`;
    return `Played ${sport}`;
  }

  if (status === "cancelled") return `${title} cancelled`;
  if (status === "missed" || !positive) return `${title} not done`;
  return `${title} done`;
}

export function formatDurationMinutes(
  duration: number | null | undefined,
): string | null {
  if (
    typeof duration !== "number" ||
    !Number.isFinite(duration) ||
    duration <= 0
  )
    return null;
  const rounded = Math.round(duration);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}
