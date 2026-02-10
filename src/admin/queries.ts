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

async function getUserEmail(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const fromUser = user?.email?.trim().toLowerCase() ?? null;
  if (fromUser && fromUser.includes("@")) return fromUser;

  const auth = await prisma.auth.findFirst({
    where: { userId },
    select: {
      identities: {
        where: { providerName: "email" },
        select: { providerUserId: true },
        take: 1,
      },
    },
  });
  const email = auth?.identities?.[0]?.providerUserId?.trim().toLowerCase() ?? null;
  return email && email.includes("@") ? email : null;
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

export const getSudoOverview: GetSudoOverview<void, SudoOverview> = async (
  _args,
  context,
) => {
  await ensureAdminOrThrow(context);

  const [usersCount, categoriesCount, entriesCount] = await Promise.all([
    context.entities.User.count(),
    context.entities.Category.count({ where: { sourceArchivedAt: null } }),
    context.entities.Event.count({ where: { kind: "SESSION" } }),
  ]);

  const users = await context.entities.User.findMany({
    select: { id: true, username: true, role: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }],
  });

  const userIds = users.map((u: any) => u.id);

  const [categoryTotals, entryTotals] = await Promise.all([
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

  const authRows = await prisma.auth.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId: true,
      identities: {
        where: { providerName: "email" },
        select: { providerUserId: true },
        take: 1,
      },
    },
  });
  const emailByUserId = new Map<string, string | null>();
  for (const row of authRows) {
    if (!row.userId) continue;
    const email = row.identities?.[0]?.providerUserId?.trim().toLowerCase() ?? null;
    emailByUserId.set(row.userId, email && email.includes("@") ? email : null);
  }

  return {
    totals: {
      users: usersCount,
      categories: categoriesCount,
      entries: entriesCount,
    },
    users: users.map((u: any) => ({
      id: u.id,
      username: u.username,
      email: emailByUserId.get(u.id) ?? null,
      role: u.role ?? "user",
      createdAt: u.createdAt,
      categoriesCount: categoriesByUserId.get(u.id) ?? 0,
      entriesCount: entriesByUserId.get(u.id) ?? 0,
    })),
  };
};
