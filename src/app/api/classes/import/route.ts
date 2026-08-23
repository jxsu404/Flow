import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createClassBlock, deleteClassBlock, listClassBlocks } from "@/lib/classes";
import { DEFAULT_TIMEZONE } from "@/lib/datetime";
import { emptyDraft, matchDuplicates } from "@/lib/schedule-import";

export const runtime = "nodejs";
export const maxDuration = 60;

const itemSchema = z.object({
  title: z.string().trim().min(1),
  days: z.array(z.number().int().min(1).max(7)).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  location: z.string().nullable().optional(),
  action: z.enum(["keep", "replace", "create"]).default("create"),
});

const bodySchema = z.object({
  items: z.array(itemSchema).min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisa las clases antes de importar." }, { status: 400 });
  }

  const [user] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  const timeZone = user?.timezone || DEFAULT_TIMEZONE;

  let created = 0;
  let skipped = 0;
  let replaced = 0;
  const errors: string[] = [];

  for (const item of parsed.data.items) {
    if (item.startTime >= item.endTime) {
      errors.push(`${item.title}: el horario no es válido`);
      continue;
    }

    const existing = await listClassBlocks(userId);
    const draft = emptyDraft({
      title: item.title,
      days: item.days,
      startTime: item.startTime,
      endTime: item.endTime,
      duplicateAction: item.action,
    });
    const dupes = matchDuplicates(draft, existing);

    if (item.action === "replace") {
      for (const dupe of dupes) {
        await deleteClassBlock(userId, dupe.id);
        replaced += 1;
      }
    }

    const days =
      item.action === "keep"
        ? item.days.filter((day) => !dupes.some((dupe) => dupe.dayOfWeek === day))
        : item.days;

    skipped += item.days.length - days.length;

    for (const dayOfWeek of days) {
      try {
        await createClassBlock(userId, timeZone, {
          title: item.title,
          dayOfWeek,
          startTime: item.startTime,
          endTime: item.endTime,
          location: item.location,
        });
        created += 1;
      } catch {
        errors.push(`No pude guardar ${item.title}`);
      }
    }
  }

  return NextResponse.json({ created, skipped, replaced, errors });
}
