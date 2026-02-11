import { HttpError, prisma } from "wasp/server";
import type { GetSudoOverview } from "wasp/server/operations";
import type { SudoOverview } from "./types";

function getAdminEmailAllowlist(): Set<string> {
  if (!process.env.MEMOATO_ADMIN_EMAILS) {
    return new Set();
  }

  const raw = (process.env.MEMOATO_ADMIN_EMAILS).trim();
  const emails = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(emails);
}

function parseProviderData(providerData: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(providerData);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function extractEmailFromProviderData(providerData: string): string | null {
  const data = parseProviderData(providerData);
  const profile = (data as any)?.profile;
  if (typeof profile?.email === "string" && profile.email.trim()) return profile.email.trim().toLowerCase();
  if (Array.isArray(profile?.emails) && typeof profile.emails?.[0]?.value === "string") {
    const v = profile.emails[0].value.trim().toLowerCase();
    return v && v.includes("@") ? v : null;
  }
  if (typeof (data as any)?.email === "string") {
    const v = String((data as any).email).trim().toLowerCase();
    return v && v.includes("@") ? v : null;
  }
  return null;
}

async function getUserEmail(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const fromUser = user?.email?.trim().toLowerCase() ?? null;
  if (fromUser && fromUser.includes("@")) return fromUser;

  const auth = await prisma.auth.findFirst({
    where: { userId },
    select: {
      identities: {
        where: { providerName: { in: ["email", "google"] } },
        select: { providerName: true, providerUserId: true, providerData: true },
      },
    },
  });
  const identities = auth?.identities ?? [];
  const emailIdentity = identities.find((i) => i.providerName === "email") ?? null;
  const googleIdentity = identities.find((i) => i.providerName === "google") ?? null;

  const fromEmailIdentity = emailIdentity?.providerUserId?.trim().toLowerCase() ?? null;
  if (fromEmailIdentity && fromEmailIdentity.includes("@")) return fromEmailIdentity;

  const fromGoogleIdentity = googleIdentity ? extractEmailFromProviderData(googleIdentity.providerData ?? "{}") : null;
  return fromGoogleIdentity && fromGoogleIdentity.includes("@") ? fromGoogleIdentity : null;
}

async function ensureAdminOrThrow(context: any): Promise<void> {
  if (!context.user) {
    throw new HttpError(404);
  }

  const allow = getAdminEmailAllowlist();
  const user = await context.entities.User.findFirst({
    where: { id: context.user.id },
    select: { id: true, role: true },
  });
  if (!user) {
    throw new HttpError(404);
  }

  if (user.role === "admin") {
    return;
  }

  const email = await getUserEmail(user.id);
  if (email && allow.has(email)) {
    await context.entities.User.update({ where: { id: user.id }, data: { role: "admin" } });
    return;
  }

  throw new HttpError(404);
}

function startOfTodayUtcLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekMondayLocal(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // Mon=0..Sun=6
  const start = new Date(now);
  start.setDate(now.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

export const getSudoOverview: GetSudoOverview<void, SudoOverview> = async (
  _args,
  context,
) => {
  await ensureAdminOrThrow(context);

  const startOfToday = startOfTodayUtcLocal();
  const startOfWeek = startOfWeekMondayLocal();

  const [usersCount, usersWithEntriesGroups, categoriesCount, entriesCount, entriesTodayCount, newUsersThisWeekCount] =
    await Promise.all([
      context.entities.User.count(),
      prisma.event.groupBy({
        by: ["userId"],
        where: { kind: "SESSION", userId: { not: null } },
        _count: { _all: true },
      }),
      context.entities.Category.count({ where: { sourceArchivedAt: null } }),
      context.entities.Event.count({ where: { kind: "SESSION" } }),
      prisma.event.count({ where: { kind: "SESSION", occurredOn: startOfToday } }),
      prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
    ]);
  const usersWithEntriesCount = usersWithEntriesGroups.length;

  const users = await context.entities.User.findMany({
    select: { id: true, username: true, role: true, createdAt: true, email: true },
    orderBy: [{ createdAt: "desc" }],
  });

  const userIds = users.map((u: any) => u.id);

  const [categoryTotals, entryTotals, lastEntryTotals] = await Promise.all([
    context.entities.Category.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, sourceArchivedAt: null },
      _count: { _all: true },
    }),
    context.entities.Event.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, kind: "SESSION" },
      _count: { _all: true },
    }),
    context.entities.Event.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, kind: "SESSION" },
      _max: { occurredAt: true },
    }),
  ]);

  const categoriesByUserId = new Map<string, number>();
  for (const row of categoryTotals) {
    if (!row.userId) continue;
    categoriesByUserId.set(row.userId, row._count._all ?? 0);
  }

  const entriesByUserId = new Map<string, number>();
  for (const row of entryTotals) {
    if (!row.userId) continue;
    entriesByUserId.set(row.userId, row._count._all ?? 0);
  }

  const lastEntryAtByUserId = new Map<string, Date | null>();
  for (const row of lastEntryTotals as any[]) {
    if (!row.userId) continue;
    lastEntryAtByUserId.set(row.userId, (row as any)?._max?.occurredAt ?? null);
  }

  const authRows = await prisma.auth.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId: true,
      identities: {
        where: { providerName: { in: ["email", "google"] } },
        select: { providerName: true, providerUserId: true, providerData: true },
      },
    },
  });
  const identityEmailByUserId = new Map<string, string | null>();
  for (const row of authRows) {
    if (!row.userId) continue;
    const identities = row.identities ?? [];
    const emailIdentity = identities.find((i) => i.providerName === "email") ?? null;
    const googleIdentity = identities.find((i) => i.providerName === "google") ?? null;
    const fromEmail = emailIdentity?.providerUserId?.trim().toLowerCase() ?? null;
    if (fromEmail && fromEmail.includes("@")) {
      identityEmailByUserId.set(row.userId, fromEmail);
      continue;
    }
    const fromGoogle = googleIdentity ? extractEmailFromProviderData(googleIdentity.providerData ?? "{}") : null;
    identityEmailByUserId.set(row.userId, fromGoogle && fromGoogle.includes("@") ? fromGoogle : null);
  }

  return {
    totals: {
      users: usersCount,
      usersWithEntries: usersWithEntriesCount,
      categories: categoriesCount,
      entries: entriesCount,
      entriesToday: entriesTodayCount,
      newUsersThisWeek: newUsersThisWeekCount,
    },
    users: users.map((u: any) => ({
      id: u.id,
      username: u.username,
      email: (u.email?.trim().toLowerCase() ?? null) || identityEmailByUserId.get(u.id) || null,
      createdAt: u.createdAt,
      lastEntryAt: lastEntryAtByUserId.get(u.id) ?? null,
      categoriesCount: categoriesByUserId.get(u.id) ?? 0,
      entriesCount: entriesByUserId.get(u.id) ?? 0,
    })),
  };
};
