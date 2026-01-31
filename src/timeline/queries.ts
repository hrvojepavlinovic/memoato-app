import { HttpError } from "wasp/server";
import type { GetDayEvents } from "wasp/server/operations";

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
        },
      },
    },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
  });

  return events;
};

