import { HttpError } from "wasp/server";
import type { GetDayEvents } from "wasp/server/operations";
import { buildScheduledDateTime, dateOnlyIso, normalizeCategorySchedule, scheduleAppliesToDate } from "../focus/schedule";

type GetDayEventsArgs = { occurredOn: string }; // YYYY-MM-DD

function parseIsoDateOnly(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new HttpError(400, "Invalid date");
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const on = new Date(y, mo - 1, d);
  on.setHours(0, 0, 0, 0);
  return on;
}

export const getDayEvents: GetDayEvents<GetDayEventsArgs, any[]> = async ({ occurredOn }, context) => {
  if (!context.user) throw new HttpError(401);

  const day = parseIsoDateOnly(occurredOn);
  const userId = context.user.id;

  const events = await context.entities.Event.findMany({
    where: {
      userId,
      kind: "SESSION",
      occurredOn: day,
      category: { userId, sourceArchivedAt: null },
    },
    select: {
      id: true,
      amount: true,
      occurredAt: true,
      occurredOn: true,
      rawText: true,
      data: true,
      category: {
        select: {
          id: true,
          title: true,
          slug: true,
          unit: true,
          categoryType: true,
          chartType: true,
          goalWeekly: true,
          goalValue: true,
          accentHex: true,
          emoji: true,
          isSystem: true,
          scheduleEnabled: true,
          scheduleType: true,
          scheduleDays: true,
          scheduleTime: true,
        },
      },
    },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
  });

  const existingCategoryIds = new Set<string>();
  for (const ev of events) {
    if (!ev.category?.id) continue;
    existingCategoryIds.add(ev.category.id);
  }

  const scheduledCategories = await context.entities.Category.findMany({
    where: {
      userId,
      sourceArchivedAt: null,
      scheduleEnabled: true,
      categoryType: { in: ["DO", "DONT"] },
    } as any,
    select: {
      id: true,
      title: true,
      slug: true,
      unit: true,
      categoryType: true,
      chartType: true,
      goalWeekly: true,
      goalValue: true,
      accentHex: true,
      emoji: true,
      isSystem: true,
      scheduleEnabled: true,
      scheduleType: true,
      scheduleDays: true,
      scheduleTime: true,
    },
  });

  const syntheticPending: any[] = [];
  for (const c of scheduledCategories as any[]) {
    if (existingCategoryIds.has(c.id)) continue;
    const schedule = normalizeCategorySchedule({
      enabled: c.scheduleEnabled === true,
      type: c.scheduleType,
      days: c.scheduleDays,
      time: c.scheduleTime,
    });
    if (!scheduleAppliesToDate(schedule, day)) continue;
    const dueAt = buildScheduledDateTime(day, schedule.time);
    syntheticPending.push({
      id: `pending:${c.id}:${dateOnlyIso(day)}`,
      amount: 0,
      occurredAt: dueAt,
      occurredOn: day,
      rawText: null,
      data: { scheduledStatus: "pending", pending: true },
      category: {
        id: c.id,
        title: c.title,
        slug: c.slug,
        unit: c.unit,
        categoryType: c.categoryType,
        chartType: c.chartType,
        goalWeekly: c.goalWeekly,
        goalValue: c.goalValue,
        accentHex: c.accentHex,
        emoji: c.emoji,
        isSystem: c.isSystem,
        scheduleEnabled: c.scheduleEnabled,
        scheduleType: c.scheduleType,
        scheduleDays: c.scheduleDays,
        scheduleTime: c.scheduleTime,
      },
    });
  }

  const merged = [...events, ...syntheticPending];
  merged.sort((a, b) => {
    const ta = new Date(a.occurredAt as any).getTime();
    const tb = new Date(b.occurredAt as any).getTime();
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });

  return merged;
};
