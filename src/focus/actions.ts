import { Category, Event } from "wasp/entities";
import { HttpError } from "wasp/server";
import {
  type CreateEvent,
  type CreateCategory,
  type DeleteCategory,
  type DeleteEvent,
  type EnsureDefaultCategories,
  type UpdateCategory,
  type UpdateEvent,
} from "wasp/server/operations";

type EnsureDefaultCategoriesArgs = void;

function titleKey(title: string): string {
  return title.trim().toLowerCase();
}

async function renameTerminToFootball(userId: string, entities: any): Promise<void> {
  const existing = await entities.Category.findMany({
    where: { userId, sourceArchivedAt: null, title: { in: ["Termin", "termin"] } },
    select: { id: true, slug: true },
  });
  if (existing.length === 0) return;

  for (const c of existing) {
    // Update title
    await entities.Category.update({ where: { id: c.id }, data: { title: "Football" } });

    // Update slug if it was the old one.
    if (!c.slug || c.slug === "termin") {
      const base = "football";
      let candidate = base;
      let n = 2;
      while (
        await entities.Category.findFirst({
          where: { userId, slug: candidate, sourceArchivedAt: null, NOT: { id: c.id } },
          select: { id: true },
        })
      ) {
        candidate = `${base}-${n}`;
        n += 1;
      }
      await entities.Category.update({ where: { id: c.id }, data: { slug: candidate } });
    }
  }
}

async function renameWorkoutToPushUps(userId: string, entities: any): Promise<void> {
  const existing = await entities.Category.findMany({
    where: { userId, sourceArchivedAt: null, title: { in: ["Workout", "workout"] } },
    select: { id: true, slug: true, accentHex: true, emoji: true, goalWeekly: true },
  });
  if (existing.length === 0) return;

  for (const c of existing) {
    // Rename + make it match the default Push ups config.
    await entities.Category.update({
      where: { id: c.id },
      data: {
        title: "Push ups",
        categoryType: "NUMBER",
        chartType: "bar",
        period: "week",
        goalWeekly: c.goalWeekly ?? 300,
        kind: "amount",
        type: "Simple",
        unit: null,
        emoji: c.emoji ?? "💪",
        accentHex: c.accentHex && c.accentHex.toUpperCase() !== "#0A0A0A" ? c.accentHex : "#F59E0B",
      },
    });

    // Update slug if it was the old one.
    if (!c.slug || c.slug === "workout") {
      const base = "push-ups";
      let candidate = base;
      let n = 2;
      while (
        await entities.Category.findFirst({
          where: { userId, slug: candidate, sourceArchivedAt: null, NOT: { id: c.id } },
          select: { id: true },
        })
      ) {
        candidate = `${base}-${n}`;
        n += 1;
      }
      await entities.Category.update({ where: { id: c.id }, data: { slug: candidate } });
    }
  }
}

function slugifyTitle(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return s.length > 0 ? s : "category";
}

async function ensureCategorySlugs(userId: string, entities: any): Promise<void> {
  const categories = await entities.Category.findMany({
    where: { userId, sourceArchivedAt: null },
    select: { id: true, title: true, slug: true },
    orderBy: [{ title: "asc" }],
  });

  const used = new Set<string>();
  const desiredById = new Map<string, string>();

  for (const c of categories) {
    const base = slugifyTitle(c.slug ?? c.title);
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${n}`;
      n += 1;
    }
    used.add(candidate);
    desiredById.set(c.id, candidate);
  }

  for (const c of categories) {
    const desired = desiredById.get(c.id);
    if (!desired) continue;
    if (c.slug === desired) continue;
    await entities.Category.update({
      where: { id: c.id },
      data: { slug: desired },
    });
  }
}

async function applyKnownCategoryDefaults(
  userId: string,
  entities: any,
): Promise<void> {
  const presets: Record<
    string,
    {
      unit?: string;
      chartType?: string;
      categoryType?: "NUMBER" | "DO" | "DONT" | "GOAL";
      accentHex?: string;
      emoji?: string;
      period?: string;
      goalWeekly?: number;
      goalValue?: number;
    }
  > = {
    "active kcal": {
      unit: "kcal",
      chartType: "bar",
      categoryType: "NUMBER",
      period: "week",
      goalWeekly: 5000,
      accentHex: "#EF4444",
      emoji: "🔥",
    },
    padel: {
      chartType: "bar",
      categoryType: "NUMBER",
      period: "week",
      accentHex: "#22C55E",
      emoji: "🎾",
    },
    football: {
      chartType: "bar",
      categoryType: "NUMBER",
      period: "week",
      accentHex: "#A855F7",
      emoji: "⚽",
    },
    "pull ups": {
      chartType: "bar",
      categoryType: "NUMBER",
      period: "week",
      goalWeekly: 150,
      accentHex: "#3B82F6",
      emoji: "💪",
    },
    "push ups": {
      chartType: "bar",
      categoryType: "NUMBER",
      period: "week",
      goalWeekly: 300,
      accentHex: "#F59E0B",
      emoji: "💪",
    },
    weight: {
      unit: "kg",
      chartType: "line",
      categoryType: "GOAL",
      goalValue: 85,
      accentHex: "#0EA5E9",
      emoji: "⚖️",
    },
  };

  const categories = await entities.Category.findMany({
    // Only apply presets for imported/legacy categories (e.g. the Focus export).
    // Categories created through the app already capture their own settings.
    where: { userId, source: "focus" },
    select: {
      id: true,
      title: true,
      unit: true,
      chartType: true,
      categoryType: true,
      accentHex: true,
      emoji: true,
      period: true,
      goalWeekly: true,
      goalValue: true,
    },
  });

  for (const c of categories) {
    const preset = presets[titleKey(c.title)];
    if (!preset) continue;

    const update: Record<string, unknown> = {};

    if (preset.unit != null && (c.unit == null || c.unit.trim() === "")) {
      update.unit = preset.unit;
    }
    if (preset.chartType != null && (c.chartType == null || c.chartType.trim() === "")) {
      update.chartType = preset.chartType;
    }
    if (
      preset.categoryType != null &&
      (c.chartType == null || c.chartType.trim() === "") &&
      c.categoryType === "NUMBER"
    ) {
      // Only apply the preset type when the category looks unconfigured.
      update.categoryType = preset.categoryType;
    }

    if (preset.period != null && (c.period == null || String(c.period).trim() === "")) {
      update.period = preset.period;
    }
    if (preset.goalWeekly != null && c.goalWeekly == null) {
      update.goalWeekly = preset.goalWeekly;
    }
    if (preset.goalValue != null && c.goalValue == null) {
      update.goalValue = preset.goalValue;
    }

    // accentHex has a DB default (#0A0A0A). Treat that as "unset" for presets, but never overwrite custom colors.
    if (preset.accentHex != null && (c.accentHex == null || c.accentHex.toUpperCase() === "#0A0A0A")) {
      update.accentHex = preset.accentHex;
    }
    // Only set emoji if it's missing; don't overwrite user-custom emoji.
    if (preset.emoji != null && (c.emoji == null || String(c.emoji).trim() === "")) {
      update.emoji = preset.emoji;
    }

    if (Object.keys(update).length === 0) continue;

    await entities.Category.update({ where: { id: c.id }, data: update });
  }
}

type CreateCategoryArgs = {
  title: string;
  categoryType: "NUMBER" | "DO" | "DONT" | "GOAL";
  period?: "day" | "week" | "month" | "year";
  unit?: string;
  goal?: number;
  goalValue?: number;
  accentHex: string;
  emoji?: string;
};

function normalizeHex(s: string): string {
  const v = s.trim();
  const m = /^#([0-9a-fA-F]{6})$/.exec(v);
  if (!m) {
    throw new HttpError(400, "Accent color must be a hex color like #12AB34.");
  }
  return `#${m[1].toUpperCase()}`;
}

export const createCategory: CreateCategory<CreateCategoryArgs, Category> = async (
  { title, categoryType, period, unit, goal, goalValue, accentHex, emoji },
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const cleanTitle = title.trim();
  if (cleanTitle.length < 1) {
    throw new HttpError(400, "Title is required.");
  }

  const cleanEmoji = (emoji ?? "").trim();
  const cleanUnit = (unit ?? "").trim();
  const cleanHex = normalizeHex(accentHex);

  const needsPeriod = categoryType !== "GOAL";
  if (needsPeriod && !period) {
    throw new HttpError(400, "Period is required.");
  }

  const chartType = categoryType === "GOAL" ? "line" : "bar";
  const resolvedUnit = cleanUnit || "";

  const userId = context.user.id;
  const baseSlug = slugifyTitle(cleanTitle);
  let slug = baseSlug;
  let n = 2;
  while (
    await context.entities.Category.findFirst({
      where: { userId, slug, sourceArchivedAt: null },
      select: { id: true },
    })
  ) {
    slug = `${baseSlug}-${n}`;
    n += 1;
  }
  return context.entities.Category.create({
    data: {
      userId,
      source: "memoato",
      title: cleanTitle,
      slug,
      categoryType,
      period: needsPeriod ? period : undefined,
      unit: resolvedUnit.length > 0 ? resolvedUnit : null,
      chartType,
      accentHex: cleanHex,
      emoji: cleanEmoji.length > 0 ? cleanEmoji : null,
      goalWeekly: goal != null ? goal : undefined,
      goalValue: goalValue != null ? goalValue : undefined,
      kind: categoryType === "DO" || categoryType === "DONT" ? "count" : "amount",
      type: "Simple",
      createdAt: new Date(),
    },
  });
};

type UpdateCategoryArgs = {
  categoryId: Category["id"];
  title: string;
  categoryType: "NUMBER" | "DO" | "DONT" | "GOAL";
  period?: "day" | "week" | "month" | "year";
  unit?: string;
  goal?: number;
  goalValue?: number;
  accentHex: string;
  emoji?: string;
};

export const updateCategory: UpdateCategory<UpdateCategoryArgs, Category> = async (
  { categoryId, title, categoryType, period, unit, goal, goalValue, accentHex, emoji },
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const userId = context.user.id;
  const existing = await context.entities.Category.findFirst({
    where: { id: categoryId, userId, sourceArchivedAt: null },
    select: { id: true, slug: true },
  });
  if (!existing) {
    throw new HttpError(404, "Category not found");
  }

  const cleanTitle = title.trim();
  if (cleanTitle.length < 1) {
    throw new HttpError(400, "Title is required.");
  }

  const cleanEmoji = (emoji ?? "").trim();
  const cleanUnit = (unit ?? "").trim();
  const cleanHex = normalizeHex(accentHex);

  const needsPeriod = categoryType !== "GOAL";
  if (needsPeriod && !period) {
    throw new HttpError(400, "Period is required.");
  }

  const chartType = categoryType === "GOAL" ? "line" : "bar";
  const resolvedUnit =
    cleanUnit.length === 0 || cleanUnit.toLowerCase() === "x" ? null : cleanUnit;

  // If the category somehow has no slug (legacy), generate a stable slug once.
  let slug = existing.slug;
  if (!slug) {
    const baseSlug = slugifyTitle(cleanTitle);
    slug = baseSlug;
    let n = 2;
    while (
      await context.entities.Category.findFirst({
        where: { userId, slug, sourceArchivedAt: null, NOT: { id: categoryId } },
        select: { id: true },
      })
    ) {
      slug = `${baseSlug}-${n}`;
      n += 1;
    }
  }

  return context.entities.Category.update({
    where: { id: existing.id },
    data: {
      title: cleanTitle,
      slug,
      categoryType,
      period: needsPeriod ? period : null,
      unit: resolvedUnit,
      chartType,
      accentHex: cleanHex,
      emoji: cleanEmoji.length > 0 ? cleanEmoji : null,
      goalWeekly: categoryType === "GOAL" ? null : goal ?? null,
      goalValue: categoryType === "GOAL" ? goalValue ?? null : null,
      kind: categoryType === "DO" || categoryType === "DONT" ? "count" : "amount",
    },
  });
};

export const ensureDefaultCategories: EnsureDefaultCategories<
  EnsureDefaultCategoriesArgs,
  { created: number }
> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const userId = context.user.id;

  const existingForUser = await context.entities.Category.count({
    where: { userId },
  });
  if (existingForUser > 0) {
    await renameTerminToFootball(userId, context.entities);
    await renameWorkoutToPushUps(userId, context.entities);
    await applyKnownCategoryDefaults(userId, context.entities);
    const missingSlugs = await context.entities.Category.count({
      where: { userId, slug: null, sourceArchivedAt: null },
    });
    if (missingSlugs > 0) {
      await ensureCategorySlugs(userId, context.entities);
    }
    return { created: 0 };
  }

  // No global categories: starter categories are created per-user when they first land in the app.
  const now = new Date();
  const created = await context.entities.Category.createMany({
    data: [
      {
        userId,
        source: "memoato",
        title: "Weight",
        slug: "weight",
        categoryType: "GOAL",
        chartType: "line",
        unit: "kg",
        accentHex: "#0A0A0A",
        emoji: "⚖️",
        kind: "amount",
        type: "Simple",
        createdAt: now,
      },
      {
        userId,
        source: "memoato",
        title: "Push ups",
        slug: "push-ups",
        categoryType: "NUMBER",
        chartType: "bar",
        period: "week",
        goalWeekly: 300,
        accentHex: "#F59E0B",
        emoji: "💪",
        kind: "amount",
        type: "Simple",
        createdAt: now,
      },
    ],
    skipDuplicates: true,
  });
  await ensureCategorySlugs(userId, context.entities);
  return { created: created.count };
};

type DeleteCategoryArgs = {
  categoryId: Category["id"];
};

export const deleteCategory: DeleteCategory<DeleteCategoryArgs, { ok: boolean }> = async (
  { categoryId },
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const userId = context.user.id;
  const existing = await context.entities.Category.findFirst({
    where: { id: categoryId, userId, sourceArchivedAt: null },
    select: { id: true },
  });
  if (!existing) {
    throw new HttpError(404, "Category not found");
  }

  // Hard-delete category and its events.
  await context.entities.Event.deleteMany({ where: { userId, categoryId: existing.id } });
  await context.entities.Category.delete({ where: { id: existing.id } });
  return { ok: true };
};

type CreateEventArgs = {
  categoryId: Category["id"];
  amount: number;
  occurredOn?: string; // YYYY-MM-DD
};

function parseOccurred(occurredOn?: string): { occurredAt: Date; occurredOn: Date } {
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  if (!occurredOn || occurredOn === todayIso) {
    const on = new Date(now);
    on.setHours(0, 0, 0, 0);
    return { occurredAt: now, occurredOn: on };
  }

  const [y, m, d] = occurredOn.split("-").map((x) => Number(x));
  const on = new Date(y, m - 1, d);
  on.setHours(0, 0, 0, 0);
  const at = new Date(on);
  at.setHours(12, 0, 0, 0);
  return { occurredAt: at, occurredOn: on };
}

export const createEvent: CreateEvent<CreateEventArgs, Event> = async (
  { categoryId, amount, occurredOn },
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const userId = context.user.id;

  const category = await context.entities.Category.findFirst({
    where: { id: categoryId, userId },
    select: { title: true, unit: true },
  });
  if (!category) {
    throw new HttpError(404, "Category not found");
  }

  const occurred = parseOccurred(occurredOn);
  const unit = category.unit && category.unit !== "x" ? ` ${category.unit}` : "";
  return context.entities.Event.create({
    data: {
      userId,
      source: "memoato",
      kind: "SESSION",
      categoryId,
      amount,
      rawText: `${category.title} ${amount}${unit}`,
      occurredAt: occurred.occurredAt,
      occurredOn: occurred.occurredOn,
    },
  });
};

type UpdateEventArgs = {
  eventId: Event["id"];
  amount: number;
  occurredAt: string; // datetime-local (YYYY-MM-DDTHH:mm) or ISO
  note?: string | null;
};

function parseOccurredAt(occurredAt: string): { occurredAt: Date; occurredOn: Date } {
  const d = new Date(occurredAt);
  if (Number.isNaN(d.getTime())) {
    throw new HttpError(400, "Invalid date/time");
  }
  const on = new Date(d);
  on.setHours(0, 0, 0, 0);
  return { occurredAt: d, occurredOn: on };
}

export const updateEvent: UpdateEvent<UpdateEventArgs, Event> = async (
  { eventId, amount, occurredAt, note },
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const userId = context.user.id;

  const existing = await context.entities.Event.findFirst({
    where: { id: eventId, userId, kind: "SESSION" },
    select: { id: true, data: true, categoryId: true, category: { select: { title: true, unit: true } } },
  });
  if (!existing) {
    throw new HttpError(404, "Event not found");
  }

  const occurred = parseOccurredAt(occurredAt);
  const unit =
    existing.category?.unit && existing.category.unit !== "x"
      ? ` ${existing.category.unit}`
      : "";
  const title = existing.category?.title ?? "Entry";

  const baseData =
    existing.data && typeof existing.data === "object" && !Array.isArray(existing.data)
      ? (existing.data as Record<string, unknown>)
      : {};
  const nextData: Record<string, unknown> = { ...baseData };
  if ("tags" in nextData) {
    delete nextData.tags;
  }
  if (note !== undefined) {
    const cleanNote = typeof note === "string" ? note.trim() : "";
    nextData.note = cleanNote ? cleanNote : null;
  }
  return context.entities.Event.update({
    where: { id: existing.id },
    data: {
      amount,
      rawText: `${title} ${amount}${unit}`,
      occurredAt: occurred.occurredAt,
      occurredOn: occurred.occurredOn,
      data: nextData as any,
    },
  });
};

type DeleteEventArgs = {
  eventId: Event["id"];
};

export const deleteEvent: DeleteEvent<DeleteEventArgs, { id: string }> = async (
  { eventId },
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const userId = context.user.id;

  const existing = await context.entities.Event.findFirst({
    where: { id: eventId, userId, kind: "SESSION" },
    select: { id: true },
  });
  if (!existing) {
    throw new HttpError(404, "Event not found");
  }

  await context.entities.Event.delete({ where: { id: existing.id } });
  return { id: existing.id };
};
