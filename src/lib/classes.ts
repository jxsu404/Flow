import { addDays, getISODay } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { classBlocks, type ClassBlock, type NewClassBlock } from "@/db/schema";
import { createRecurringClassEvent, deleteCalendarEvent } from "./calendar/google";
import { parseDayOfWeek } from "./datetime";

function nextDateForIsoDay(isoDay: number, timeZone: string, from = new Date()): string {
  for (let i = 0; i < 7; i += 1) {
    const candidate = addDays(from, i);
    const dateStr = formatInTimeZone(candidate, timeZone, "yyyy-MM-dd");
    const noon = fromZonedTime(`${dateStr}T12:00:00`, timeZone);
    if (getISODay(noon) === isoDay) return dateStr;
  }
  return formatInTimeZone(from, timeZone, "yyyy-MM-dd");
}

export async function listClassBlocks(userId: string): Promise<ClassBlock[]> {
  const db = getDb();
  return db.select().from(classBlocks).where(eq(classBlocks.userId, userId));
}

export async function createClassBlock(
  userId: string,
  timeZone: string,
  input: {
    title: string;
    dayOfWeek: string | number;
    startTime: string;
    endTime: string;
    location?: string | null;
  },
): Promise<{ block: ClassBlock; calendarSynced: boolean }> {
  const db = getDb();
  const dayOfWeek = parseDayOfWeek(input.dayOfWeek);
  const values: NewClassBlock = {
    userId,
    title: input.title,
    dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location ?? null,
  };
  const [block] = await db.insert(classBlocks).values(values).returning();
  if (!block) throw new Error("No se pudo guardar la clase");

  let calendarSynced = false;
  try {
    const date = nextDateForIsoDay(dayOfWeek, timeZone);
    const calendarEventId = await createRecurringClassEvent(userId, {
      title: block.title,
      dayOfWeek,
      startTime: block.startTime,
      endTime: block.endTime,
      timeZone,
      location: block.location,
      date,
    });
    if (calendarEventId) {
      const [updated] = await db
        .update(classBlocks)
        .set({ calendarEventId })
        .where(eq(classBlocks.id, block.id))
        .returning();
      calendarSynced = true;
      return { block: updated ?? block, calendarSynced };
    }
  } catch {
    calendarSynced = false;
  }

  return { block, calendarSynced };
}

export async function deleteClassBlock(userId: string, id: string): Promise<ClassBlock | null> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(classBlocks)
    .where(and(eq(classBlocks.id, id), eq(classBlocks.userId, userId)))
    .limit(1);
  if (!existing) return null;
  if (existing.calendarEventId) {
    try {
      await deleteCalendarEvent(userId, existing.calendarEventId);
    } catch {
      // ignore calendar errors
    }
  }
  await db.delete(classBlocks).where(eq(classBlocks.id, existing.id));
  return existing;
}

export function sortClassBlocks(blocks: ClassBlock[]) {
  return [...blocks].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.startTime.localeCompare(b.startTime);
  });
}
