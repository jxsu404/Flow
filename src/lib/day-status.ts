import { formatInTimeZone } from "date-fns-tz";
import type { Item } from "@/db/schema";
import { AWAKE_END, AWAKE_START, type Interval } from "./availability";

export type DayStatus = "free" | "freeWithDue" | "partial" | "busy";

export type DayObligation = {
  id: string;
  title: string;
  type: Item["type"] | "calendar";
  timeLabel: string;
  afterHours: boolean;
  due: boolean;
};

export function isOutsideUsualHours(date: Date, timeZone: string): boolean {
  const hm = formatInTimeZone(date, timeZone, "HH:mm");
  return hm >= AWAKE_END || hm < AWAKE_START;
}

function clockOnDate(item: Item, dateStr: string, timeZone: string): Date | null {
  if (item.dueAt && formatInTimeZone(item.dueAt, timeZone, "yyyy-MM-dd") === dateStr) {
    return item.dueAt;
  }
  if (item.startAt && formatInTimeZone(item.startAt, timeZone, "yyyy-MM-dd") === dateStr) {
    return item.startAt;
  }
  return null;
}

export function obligationsOnDate(
  items: Item[],
  calendarBusy: Interval[],
  dateStr: string,
  timeZone: string,
): DayObligation[] {
  const seen = new Set<string>();
  const result: DayObligation[] = [];

  for (const item of items) {
    if (item.status !== "pending") continue;
    const dueDate = item.dueAt ? formatInTimeZone(item.dueAt, timeZone, "yyyy-MM-dd") : null;
    const startDate = item.startAt ? formatInTimeZone(item.startAt, timeZone, "yyyy-MM-dd") : null;
    if (dueDate !== dateStr && startDate !== dateStr) continue;
    const clock = clockOnDate(item, dateStr, timeZone);
    const key = `item:${item.id}`;
    seen.add(item.title.trim().toLowerCase());
    result.push({
      id: key,
      title: item.title,
      type: item.type,
      timeLabel: clock ? formatInTimeZone(clock, timeZone, "HH:mm") : "",
      afterHours: clock ? isOutsideUsualHours(clock, timeZone) : false,
      due: dueDate === dateStr,
    });
  }

  for (const interval of calendarBusy) {
    const startDate = formatInTimeZone(interval.start, timeZone, "yyyy-MM-dd");
    if (startDate !== dateStr) continue;
    if (!isOutsideUsualHours(interval.start, timeZone)) continue;
    const title = interval.title ?? "Evento";
    if (seen.has(title.trim().toLowerCase())) continue;
    result.push({
      id: `cal:${interval.start.toISOString()}`,
      title,
      type: "calendar",
      timeLabel: formatInTimeZone(interval.start, timeZone, "HH:mm"),
      afterHours: true,
      due: false,
    });
  }

  return result.sort((a, b) => a.timeLabel.localeCompare(b.timeLabel) || a.title.localeCompare(b.title, "es"));
}

function countPhrase(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

export function obligationPhrase(items: DayObligation[]): string | null {
  if (items.length === 0) return null;
  const exams = items.filter((item) => item.type === "exam").length;
  const assignments = items.filter((item) => item.type === "assignment").length;
  const tasks = items.filter((item) => item.type === "task").length;
  const events = items.filter((item) => item.type === "event" || item.type === "calendar").length;
  const parts: string[] = [];
  if (exams) parts.push(countPhrase(exams, "examen", "exámenes"));
  if (assignments) parts.push(countPhrase(assignments, "entrega pendiente", "entregas pendientes"));
  if (tasks) parts.push(countPhrase(tasks, "tarea pendiente", "tareas pendientes"));
  if (events) parts.push(countPhrase(events, "evento", "eventos"));
  if (parts.length === 0) {
    return countPhrase(items.length, "pendiente", "pendientes");
  }
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} y ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}`;
}

function occupancyPct(
  busy: Array<{ start: Date; end: Date }>,
  free: Array<{ start: Date; end: Date }>,
): number {
  let busyMin = 0;
  let freeMin = 0;
  for (const segment of busy) {
    busyMin += Math.max(0, (segment.end.getTime() - segment.start.getTime()) / 60_000);
  }
  for (const segment of free) {
    freeMin += Math.max(0, (segment.end.getTime() - segment.start.getTime()) / 60_000);
  }
  const total = busyMin + freeMin;
  return total === 0 ? 0 : (busyMin / total) * 100;
}

export function classifyDay(input: {
  busy: Array<{ start: Date; end: Date }>;
  free: Array<{ start: Date; end: Date }>;
  obligations: DayObligation[];
  isToday: boolean;
  suggestion?: { title: string; dueLabel: string } | null;
}): { status: DayStatus; summary: string } {
  const phrase = obligationPhrase(input.obligations);
  const hasBusy = input.busy.length > 0;
  const pct = occupancyPct(input.busy, input.free);

  if (!hasBusy && phrase) {
    return {
      status: "freeWithDue",
      summary: `Tu día está libre de clases, pero tienes ${phrase}.`,
    };
  }

  if (!hasBusy) {
    const base = input.isToday
      ? "Tu día está bastante libre."
      : `Nada fijo. Bloques libres entre ${AWAKE_START} y ${AWAKE_END}.`;
    if (input.suggestion) {
      return {
        status: "free",
        summary: `${base} Puedes usar este tiempo para ${input.suggestion.title} (${input.suggestion.dueLabel}).`,
      };
    }
    return { status: "free", summary: base };
  }

  if (pct < 50) {
    return {
      status: "partial",
      summary: phrase
        ? `Tienes algunas cosas programadas y ${phrase}.`
        : "Tienes algunas cosas programadas, pero todavía tienes bastante tiempo libre.",
    };
  }

  return {
    status: "busy",
    summary: phrase
      ? `Tienes un día bastante ocupado y ${phrase}.`
      : "Tienes un día bastante ocupado.",
  };
}
