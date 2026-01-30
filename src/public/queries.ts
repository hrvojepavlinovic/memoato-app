import { prisma } from "wasp/server";
import type { GetPublicTotals } from "wasp/server/operations";

export type PublicTotals = {
  totalUsers: number;
  totalCategories: number;
  totalEvents: number;
  updatedAt: string;
};

export const getPublicTotals: GetPublicTotals<void, PublicTotals> = async (_args, _context) => {
  const [totalUsers, totalCategories, totalEvents] = await Promise.all([
    prisma.user.count(),
    prisma.category.count(),
    prisma.event.count(),
  ]);

  return {
    totalUsers,
    totalCategories,
    totalEvents,
    updatedAt: new Date().toISOString(),
  };
};

