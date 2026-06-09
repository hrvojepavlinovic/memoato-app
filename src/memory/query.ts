type PrismaLike = any;

const DEFAULT_TAKE = 20;
const MAX_SEARCH_TAKE = 50;
const MAX_SCAN = 2000;

function cleanText(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalize(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function rangeForPreset(raw: unknown): { from: Date; to: Date } | null {
  const preset = normalize(raw).replace(/-/g, "_");
  const now = new Date();
  const today = startOfLocalDay(now);
  const weekStartsOnMondayOffset = (today.getDay() + 6) % 7;
  const thisWeekStart = addDays(today, -weekStartsOnMondayOffset);
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  if (preset === "today") return { from: today, to: endOfLocalDay(today) };
  if (preset === "yesterday") {
    const y = addDays(today, -1);
    return { from: y, to: endOfLocalDay(y) };
  }
  if (preset === "last_7_days") return { from: addDays(today, -6), to: endOfLocalDay(today) };
  if (preset === "last_30_days") return { from: addDays(today, -29), to: endOfLocalDay(today) };
  if (preset === "this_week") return { from: thisWeekStart, to: endOfLocalDay(today) };
  if (preset === "last_week") {
    const start = addDays(thisWeekStart, -7);
    return { from: start, to: endOfLocalDay(addDays(thisWeekStart, -1)) };
  }
  if (preset === "this_month") return { from: thisMonthStart, to: endOfLocalDay(today) };
  if (preset === "last_month") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
    return { from: start, to: end };
  }

  return null;
}

function parseRange(args: { from?: unknown; to?: unknown; period?: unknown }): { from?: Date; to?: Date } {
  const preset = rangeForPreset(args.period);
  const from = parseDate(args.from) ?? preset?.from;
  const to = parseDate(args.to) ?? preset?.to;
  return { from: from ?? undefined, to: to ?? undefined };
}

function clampTake(value: unknown, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_TAKE;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

function factFromData(data: unknown): any | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const direct = (data as any).fact;
  if (direct && typeof direct === "object" && !Array.isArray(direct)) return direct;
  return null;
}

function factsFromData(data: unknown): any[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const direct = factFromData(data);
  if (direct) return [direct];
  const facts = (data as any)?.memoatoMemory?.extraction?.facts;
  return Array.isArray(facts) ? facts.filter((f) => f && typeof f === "object") : [];
}

function tagsFromData(data: unknown): string[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const direct = (data as any).tags;
  const memoato = (data as any)?.memoatoMemory?.tags;
  const tags = Array.isArray(direct) ? direct : Array.isArray(memoato) ? memoato : [];
  return tags.filter((x): x is string => typeof x === "string");
}

function eventHaystack(event: any): string {
  const facts = factsFromData(event.data);
  const factText = facts
    .map((f) => [f.kind, f.label, f.canonical, f.unit, f.note, ...(Array.isArray(f.categoryCandidates) ? f.categoryCandidates : [])].join(" "))
    .join(" ");
  return normalize([
    event.rawText,
    event.source,
    event.kind,
    event.category?.title,
    event.category?.slug,
    event.category?.unit,
    tagsFromData(event.data).join(" "),
    factText,
  ].join(" "));
}

function matchesQuery(event: any, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = eventHaystack(event);
  return terms.every((term) => haystack.includes(term));
}

function queryTerms(query: unknown): string[] {
  return normalize(query)
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function eventWhere(userId: string, args: { from?: Date; to?: Date }) {
  return {
    userId,
    ...(args.from || args.to
      ? {
          occurredAt: {
            ...(args.from ? { gte: args.from } : {}),
            ...(args.to ? { lte: args.to } : {}),
          },
        }
      : {}),
  };
}

function eventToResult(event: any) {
  const facts = factsFromData(event.data);
  return {
    id: event.id,
    kind: event.kind,
    source: event.source,
    rawText: event.rawText,
    amount: event.amount,
    duration: event.duration,
    occurredAt: event.occurredAt,
    occurredOn: event.occurredOn,
    category: event.category
      ? {
          id: event.category.id,
          title: event.category.title,
          slug: event.category.slug,
          unit: event.category.unit,
        }
      : null,
    facts,
    tags: tagsFromData(event.data),
  };
}

export async function searchMemoryEntries(args: {
  prisma: PrismaLike;
  userId: string;
  body: unknown;
}) {
  const body = args.body && typeof args.body === "object" && !Array.isArray(args.body) ? (args.body as any) : {};
  const terms = queryTerms(body.query);
  const take = clampTake(body.take, MAX_SEARCH_TAKE);
  const range = parseRange({ from: body.from, to: body.to, period: body.period });

  const events = await args.prisma.event.findMany({
    where: eventWhere(args.userId, range),
    include: { category: { select: { id: true, title: true, slug: true, unit: true } } },
    orderBy: [{ occurredAt: "desc" }],
    take: MAX_SCAN,
  });

  const matches = events.filter((event: any) => matchesQuery(event, terms)).slice(0, take);
  return {
    query: cleanText(body.query),
    from: range.from?.toISOString() ?? null,
    to: range.to?.toISOString() ?? null,
    count: matches.length,
    entries: matches.map(eventToResult),
  };
}

export async function summarizeMemoryMetric(args: {
  prisma: PrismaLike;
  userId: string;
  body: unknown;
}) {
  const body = args.body && typeof args.body === "object" && !Array.isArray(args.body) ? (args.body as any) : {};
  const metric = cleanText(body.metric ?? body.query);
  if (!metric) throw new Error("missing_metric");
  const terms = queryTerms(metric);
  const range = parseRange({ from: body.from, to: body.to, period: body.period ?? "last_30_days" });

  const events = await args.prisma.event.findMany({
    where: {
      ...eventWhere(args.userId, range),
      kind: "SESSION",
    },
    include: { category: { select: { id: true, title: true, slug: true, unit: true } } },
    orderBy: [{ occurredAt: "asc" }],
    take: MAX_SCAN,
  });

  const matches = events.filter((event: any) => matchesQuery(event, terms));
  const amounts = matches
    .map((event: any) => (typeof event.amount === "number" && Number.isFinite(event.amount) ? event.amount : null))
    .filter((n: number | null): n is number => n != null);
  const total = amounts.reduce((sum: number, n: number) => sum + n, 0);
  const durationMinutes = matches.reduce((sum: number, event: any) => {
    const n = typeof event.duration === "number" && Number.isFinite(event.duration) ? event.duration : 0;
    return sum + n;
  }, 0);

  const unitCounts = new Map<string, number>();
  for (const event of matches) {
    const fact = factFromData(event.data);
    const unit = cleanText(fact?.unit ?? event.category?.unit);
    if (!unit) continue;
    unitCounts.set(unit, (unitCounts.get(unit) ?? 0) + 1);
  }
  const unit = Array.from(unitCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    metric,
    from: range.from?.toISOString() ?? null,
    to: range.to?.toISOString() ?? null,
    count: matches.length,
    total,
    unit,
    durationMinutes,
    firstOccurredAt: matches[0]?.occurredAt ?? null,
    lastOccurredAt: matches[matches.length - 1]?.occurredAt ?? null,
    entries: matches.slice(-20).map(eventToResult),
  };
}
