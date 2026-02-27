export type ExtractedTime = {
  hour: number; // 0-23
  minute: number; // 0-59
  source: string;
  start: number;
  end: number;
};

function normalizeMeridiem(raw: string | undefined): "am" | "pm" | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(/\./g, "");
  if (s === "am") return "am";
  if (s === "pm") return "pm";
  return null;
}

export function extractTimeFromText(raw: string): ExtractedTime | null {
  if (!raw.trim()) return null;

  const colonMatch = /\b(\d{1,2}):([0-5]\d)\s*([ap]\.?m\.?)?\b/i.exec(raw);
  if (colonMatch) {
    const hourRaw = Number(colonMatch[1]);
    const minute = Number(colonMatch[2]);
    const meridiem = normalizeMeridiem(colonMatch[3]);
    const start = colonMatch.index ?? 0;
    const end = start + colonMatch[0].length;
    if (!Number.isFinite(hourRaw) || !Number.isFinite(minute)) return null;

    if (meridiem) {
      if (hourRaw < 1 || hourRaw > 12) return null;
      let hour = hourRaw;
      if (meridiem === "am" && hour === 12) hour = 0;
      if (meridiem === "pm" && hour < 12) hour += 12;
      return { hour, minute, source: colonMatch[0], start, end };
    }

    if (hourRaw < 0 || hourRaw > 23) return null;
    return { hour: hourRaw, minute, source: colonMatch[0], start, end };
  }

  const ampmOnlyMatch = /\b(1[0-2]|0?[1-9])\s*([ap]\.?m\.?)\b/i.exec(raw);
  if (ampmOnlyMatch) {
    const hourRaw = Number(ampmOnlyMatch[1]);
    const meridiem = normalizeMeridiem(ampmOnlyMatch[2]);
    const start = ampmOnlyMatch.index ?? 0;
    const end = start + ampmOnlyMatch[0].length;
    if (!Number.isFinite(hourRaw) || !meridiem) return null;
    let hour = hourRaw;
    if (meridiem === "am" && hour === 12) hour = 0;
    if (meridiem === "pm" && hour < 12) hour += 12;
    return { hour, minute: 0, source: ampmOnlyMatch[0], start, end };
  }

  return null;
}
