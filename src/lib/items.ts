import { and, desc, eq, gte, ilike, or } from "drizzle-orm";
import { getDb } from "@/db";
import { items, type Item, type NewItem } from "@/db/schema";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "./calendar/google";
import { parseUserDateTime } from "./datetime";

export type ItemInput = {
  type: Item["type"];
  title: string;
  notes?: string | null;
  dueAt?: string | Date | null;
  startAt?: string | Date | null;
  endAt?: string | Date | null;
  durationMinutes?: number | null;
  priority?: Item["priority"];
  status?: Item["status"];
  source?: Item["source"];
};

function asDate(value: string | Date | null | undefined, timeZone: string): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  return parseUserDateTime(value, timeZone);
}

function eventWindow(item: Pick<Item, "type" | "dueAt" | "startAt" | "endAt" | "durationMinutes">) {
  const start = item.startAt ?? item.dueAt;
  if (!start) return null;
  const duration =
    item.durationMinutes ??
    (item.type === "exam" ? 120 : item.type === "event" ? 60 : 30);
  const end = item.endAt ?? new Date(start.getTime() + duration * 60_000);
  const allDay = !item.startAt && item.dueAt && item.dueAt.getUTCHours() === 0 && item.dueAt.getUTCMinutes() === 0 && !item.durationMinutes;
  return { start, end, allDay: Boolean(allDay && item.type === "assignment") };
}

export async function listItems(userId: string, status?: Item["status"]): Promise<Item[]> {
  const db = getDb();
  const where = status
    ? and(eq(items.userId, userId), eq(items.status, status))
    : eq(items.userId, userId);
  return db.select().from(items).where(where).orderBy(desc(items.dueAt), desc(items.createdAt));
}

export async function findItemsByQuery(userId: string, query: string): Promise<Item[]> {
  const db = getDb();
  return db
    .select()
    .from(items)
    .where(and(eq(items.userId, userId), ilike(items.title, `%${query}%`)))
    .orderBy(desc(items.updatedAt))
    .limit(8);
}

export async function createItem(
  userId: string,
  timeZone: string,
  input: ItemInput,
): Promise<{ item: Item; calendarSynced: boolean }> {
  const db = getDb();
  const dueAt = asDate(input.dueAt, timeZone);
  const startAt = asDate(input.startAt, timeZone);
  const endAt = asDate(input.endAt, timeZone);

  const values: NewItem = {
    userId,
    type: input.type,
    title: input.title,
    notes: input.notes ?? null,
    dueAt,
    startAt,
    endAt,
    durationMinutes: input.durationMinutes ?? null,
    priority: input.priority ?? "medium",
    status: input.status ?? "pending",
    source: input.source ?? "text",
  };

  const [item] = await db.insert(items).values(values).returning();
  if (!item) throw new Error("No se pudo crear el ítem");

  const window = eventWindow(item);
  let calendarSynced = false;
  if (window && item.type !== "task") {
    try {
      const calendarEventId = await createCalendarEvent(userId, {
        title: item.title,
        notes: item.notes,
        start: window.start,
        end: window.end,
        timeZone,
        type: item.type,
        allDay: window.allDay,
      });
      if (calendarEventId) {
        const [updated] = await db
          .update(items)
          .set({ calendarEventId, updatedAt: new Date() })
          .where(eq(items.id, item.id))
          .returning();
        calendarSynced = true;
        return { item: updated ?? item, calendarSynced };
      }
    } catch {
      calendarSynced = false;
    }
  }

  return { item, calendarSynced };
}

export async function updateItem(
  userId: string,
  timeZone: string,
  id: string,
  input: Partial<ItemInput>,
): Promise<{ item: Item; calendarSynced: boolean } | null> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(items)
    .where(and(eq(items.id, id), eq(items.userId, userId)))
    .limit(1);
  if (!existing) return null;

  const patch: Partial<NewItem> = { updatedAt: new Date() };
  if (input.type) patch.type = input.type;
  if (input.title) patch.title = input.title;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.priority) patch.priority = input.priority;
  if (input.status) patch.status = input.status;
  if (input.durationMinutes !== undefined) patch.durationMinutes = input.durationMinutes;
  if (input.dueAt !== undefined) patch.dueAt = asDate(input.dueAt, timeZone);
  if (input.startAt !== undefined) patch.startAt = asDate(input.startAt, timeZone);
  if (input.endAt !== undefined) patch.endAt = asDate(input.endAt, timeZone);

  const [item] = await db
    .update(items)
    .set(patch)
    .where(eq(items.id, existing.id))
    .returning();
  if (!item) return null;

  let calendarSynced = false;
  if (item.calendarEventId) {
    const window = eventWindow(item);
    try {
      calendarSynced = await updateCalendarEvent(userId, item.calendarEventId, {
        title: item.title,
        notes: item.notes,
        start: window?.start,
        end: window?.end,
        timeZone,
        type: item.type,
      });
    } catch {
      calendarSynced = false;
    }
  }

  return { item, calendarSynced };
}

export async function deleteItem(userId: string, id: string): Promise<Item | null> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(items)
    .where(and(eq(items.id, id), eq(items.userId, userId)))
    .limit(1);
  if (!existing) return null;
  if (existing.calendarEventId) {
    try {
      await deleteCalendarEvent(userId, existing.calendarEventId);
    } catch {
      // keep deleting locally
    }
  }
  await db.delete(items).where(eq(items.id, existing.id));
  return existing;
}

export async function upcomingAssignments(userId: string, from: Date) {
  const db = getDb();
  return db
    .select()
    .from(items)
    .where(
      and(
        eq(items.userId, userId),
        eq(items.status, "pending"),
        or(eq(items.type, "assignment"), eq(items.type, "exam")),
        gte(items.dueAt, from),
      ),
    )
    .orderBy(items.dueAt);
}
