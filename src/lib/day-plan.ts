import { addDays, getISODay } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";
import type { ClassBlock, Item } from "@/db/schema";
import {
  AWAKE_END,
  AWAKE_START,
  clipInterval,
  DAY_PARTS,
  eachDateInZone,
  expandClassBlocks,
  findFreeSlots,
  formatRange,
  itemBusyIntervals,
  localInterval,
  type Interval,
} from "./availability";
import { ISO_DAY_LABELS } from "./datetime";

export type SuggestedWork = {
  itemId: string;
  title: string;
  type: Item["type"];
  dueLabel: string;
};

export type DaySegment =
  | {
      type: "free";
      start: Date;
      end: Date;
      rangeLabel: string;
      partLabel: string;
      suggestion: SuggestedWork | null;
    }
  | {
      type: "busy";
      start: Date;
      end: Date;
      rangeLabel: string;
      partLabel: string;
      title: string;
      kind: string;
    };

export type DayPlan = {
  date: string;
  weekday: string;
  heading: string;
  isToday: boolean;
  summary: string;
  segments: DaySegment[];
};

const DUPLICATE_MS = 2 * 60_000;

function priorityRank(priority: Item["priority"]) {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

export function isFlexibleWork(item: Item): boolean {
  if (item.status !== "pending") return false;
  if (item.type === "event") return false;
  if (item.startAt && item.endAt) return false;
  if (item.startAt && item.durationMinutes) return false;
  if (item.type === "exam" && item.dueAt) return false;
  return item.type === "task" || item.type === "assignment";
}

export function relativeDueLabel(dueAt: Date | null, today: string, timeZone: string): string {
  if (!dueAt) return "sin fecha";
  const due = formatInTimeZone(dueAt, timeZone, "yyyy-MM-dd");
  if (due < today) return "vencida";
  if (due === today) return "hoy";
  const tomorrow = formatInTimeZone(addDays(fromZonedTime(`${today}T12:00:00`, timeZone), 1), timeZone, "yyyy-MM-dd");
  if (due === tomorrow) return "mañana";
  return formatInTimeZone(dueAt, timeZone, "EEEE d MMM", { locale: es });
}

function roughlySame(a: Interval, b: Interval): boolean {
  return (
    Math.abs(a.start.getTime() - b.start.getTime()) < DUPLICATE_MS &&
    Math.abs(a.end.getTime() - b.end.getTime()) < DUPLICATE_MS
  );
}

export function dedupeOccupied(intervals: Interval[]): Interval[] {
  const sorted = [...intervals]
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const result: Interval[] = [];
  for (const current of sorted) {
    const last = result[result.length - 1];
    if (last && roughlySame(last, current)) {
      if (current.kind === "class") {
        last.title = current.title;
        last.kind = current.kind;
      }
      continue;
    }
    result.push({ ...current });
  }
  return result;
}

function sortFlexible(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    const aDue = a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bDue = b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;
    const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
    if (byPriority !== 0) return byPriority;
    if (a.type === "assignment" && b.type !== "assignment") return -1;
    if (b.type === "assignment" && a.type !== "assignment") return 1;
    return a.title.localeCompare(b.title, "es");
  });
}

function daySummary(plan: Pick<DayPlan, "segments" | "isToday">): string {
  const busy = plan.segments.filter((s) => s.type === "busy");
  const free = plan.segments.filter((s) => s.type === "free");
  const suggestion = free.find((s) => s.type === "free" && s.suggestion)?.suggestion;

  if (busy.length === 0 && free.length === 0) {
    return plan.isToday
      ? "Ya pasó el horario despierto. De 22:00 a 07:00 cuenta como descanso."
      : "Sin bloques en el horario despierto.";
  }
  if (busy.length === 0) {
    if (suggestion) {
      return `Nada fijo. Puedes usar este tiempo para ${suggestion.title} (${suggestion.dueLabel}).`;
    }
    return `Nada fijo. Bloques libres entre ${AWAKE_START} y ${AWAKE_END}.`;
  }
  const classCount = busy.filter((s) => s.type === "busy" && s.kind === "class").length;
  const otherCount = busy.length - classCount;
  const bits: string[] = [];
  if (classCount) bits.push(`${classCount} ${classCount === 1 ? "clase" : "clases"}`);
  if (otherCount) bits.push(`${otherCount} ${otherCount === 1 ? "actividad" : "actividades"}`);
  if (free.length) bits.push(`${free.length} ${free.length === 1 ? "bloque libre" : "bloques libres"}`);
  if (suggestion) bits.push(`sugerencia: ${suggestion.title}`);
  return bits.join(" · ");
}

function assignSuggestions(days: DayPlan[], items: Item[], timeZone: string, today: string): void {
  const queue = sortFlexible(items.filter(isFlexibleWork));
  const used = new Set<string>();

  for (const day of days) {
    for (const segment of day.segments) {
      if (segment.type !== "free" || segment.suggestion) continue;
      const candidate = queue.find((item) => {
        if (used.has(item.id)) return false;
        if (!item.dueAt) return true;
        const due = formatInTimeZone(item.dueAt, timeZone, "yyyy-MM-dd");
        if (due < today) return true;
        return due >= day.date;
      });
      if (!candidate) continue;
      used.add(candidate.id);
      segment.suggestion = {
        itemId: candidate.id,
        title: candidate.title,
        type: candidate.type,
        dueLabel: relativeDueLabel(candidate.dueAt, today, timeZone),
      };
    }
  }
}

export function buildDayPlans(input: {
  from: Date;
  to: Date;
  timeZone: string;
  classBlocks: Pick<ClassBlock, "title" | "dayOfWeek" | "startTime" | "endTime">[];
  items: Item[];
  calendarBusy: Interval[];
}): DayPlan[] {
  const today = formatInTimeZone(input.from, input.timeZone, "yyyy-MM-dd");
  const busy = dedupeOccupied([
    ...expandClassBlocks(input.classBlocks, input.from, input.to, input.timeZone),
    ...itemBusyIntervals(input.items),
    ...input.calendarBusy,
  ]);
  const freeSlots = findFreeSlots(input);

  const days: DayPlan[] = [];
  for (const date of eachDateInZone(input.from, input.to, input.timeZone)) {
    const occupied: DaySegment[] = [];
    for (const part of DAY_PARTS) {
      const partWindow = localInterval(date, part.start, part.end, input.timeZone);
      for (const block of busy) {
        const clipped = clipInterval(block, partWindow.start, partWindow.end);
        if (!clipped) continue;
        occupied.push({
          type: "busy",
          start: clipped.start,
          end: clipped.end,
          rangeLabel: formatRange(clipped.start, clipped.end, input.timeZone),
          partLabel: part.label,
          title: clipped.title ?? "Ocupado",
          kind: clipped.kind ?? "event",
        });
      }
    }

    const free: DaySegment[] = freeSlots
      .filter((slot) => slot.date === date)
      .map((slot) => ({
        type: "free" as const,
        start: slot.start,
        end: slot.end,
        rangeLabel: slot.rangeLabel,
        partLabel: slot.partLabel,
        suggestion: null,
      }));

    const noon = fromZonedTime(`${date}T12:00:00`, input.timeZone);
    const isoDay = getISODay(noon);
    const weekday = ISO_DAY_LABELS[isoDay] ?? "";
    const plan: DayPlan = {
      date,
      weekday,
      heading: `${weekday} ${formatInTimeZone(noon, input.timeZone, "d MMM")}`,
      isToday: date === today,
      summary: "",
      segments: [...occupied, ...free].sort((a, b) => a.start.getTime() - b.start.getTime()),
    };
    days.push(plan);
  }

  assignSuggestions(days, input.items, input.timeZone, today);
  for (const day of days) {
    day.summary = daySummary(day);
  }
  return days;
}
