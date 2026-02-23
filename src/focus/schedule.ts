export type ScheduleType = "daily" | "weekly";

export type CategoryScheduleConfig = {
  enabled: boolean;
  type: ScheduleType | null;
  days: number[] | null;
  time: string | null; // HH:mm
};

function uniqueSortedDays(days: number[]): number[] {
  return Array.from(new Set(days)).sort((a, b) => a - b);
}

export function normalizeScheduleTime(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!m) return null;
  return `${m[1]}:${m[2]}`;
}

export function normalizeScheduleDays(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const days: number[] = [];
  for (const item of raw) {
    const value = Number(item);
    if (!Number.isInteger(value)) continue;
    if (value < 0 || value > 6) continue;
    days.push(value);
  }
  const normalized = uniqueSortedDays(days);
  return normalized.length > 0 ? normalized : null;
}

export function normalizeScheduleType(raw: unknown): ScheduleType | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (value === "daily") return "daily";
  if (value === "weekly") return "weekly";
  return null;
}

export function normalizeCategorySchedule(args: {
  enabled: unknown;
  type: unknown;
  days: unknown;
  time: unknown;
}): CategoryScheduleConfig {
  const enabled = args.enabled === true;
  if (!enabled) {
    return { enabled: false, type: null, days: null, time: null };
  }

  const type = normalizeScheduleType(args.type) ?? "weekly";
  const time = normalizeScheduleTime(args.time);
  const days = type === "daily" ? [0, 1, 2, 3, 4, 5, 6] : normalizeScheduleDays(args.days);

  return { enabled: true, type, days, time };
}

export function scheduleAppliesToDate(schedule: CategoryScheduleConfig, day: Date): boolean {
  if (!schedule.enabled) return false;
  if (schedule.type === "daily") return true;
  if (schedule.type !== "weekly") return false;
  if (!schedule.days || schedule.days.length === 0) return false;
  const weekday = day.getDay();
  return schedule.days.includes(weekday);
}

export function scheduleTimeParts(value: string | null, fallback = "20:00"): { hours: number; minutes: number } {
  const normalized = normalizeScheduleTime(value) ?? fallback;
  const [hh, mm] = normalized.split(":");
  return { hours: Number(hh ?? 20), minutes: Number(mm ?? 0) };
}

export function buildScheduledDateTime(day: Date, time: string | null, fallback = "20:00"): Date {
  const at = new Date(day);
  at.setHours(0, 0, 0, 0);
  const { hours, minutes } = scheduleTimeParts(time, fallback);
  at.setHours(hours, minutes, 0, 0);
  return at;
}

export function dateOnlyIso(day: Date): string {
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const d = String(day.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
