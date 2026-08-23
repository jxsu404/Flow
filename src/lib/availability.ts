import { addDays, getISODay } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { ClassBlock, Item } from "@/db/schema";
import { parseHm } from "./datetime";

export type Interval = {
  start: Date;
  end: Date;
  title?: string;
  kind?: string;
  location?: string | null;
};

export type FreeSlot = {
  start: Date;
  end: Date;
  minutes: number;
  label: string;
  date: string;
  partLabel: string;
  rangeLabel: string;
};

/** Horas despiertas. 22:00–07:00 cuenta como descanso, no como tiempo libre. */
export const AWAKE_START = "07:00";
export const AWAKE_END = "22:00";
const MIN_GAP_MINUTES = 30;

export const DAY_PARTS = [
  { id: "morning", label: "Mañana", start: "07:00", end: "12:00" },
  { id: "afternoon", label: "Tarde", start: "12:00", end: "18:00" },
  { id: "evening", label: "Noche", start: "18:00", end: "22:00" },
] as const;

export type DayPartId = (typeof DAY_PARTS)[number]["id"];

export function partLabelFor(date: Date, timeZone: string): string {
  const hour = Number(formatInTimeZone(date, timeZone, "H"));
  if (hour < 12) return "Mañana";
  if (hour < 18) return "Tarde";
  return "Noche";
}

export function formatRange(start: Date, end: Date, timeZone: string): string {
  return `${formatInTimeZone(start, timeZone, "HH:mm")} – ${formatInTimeZone(end, timeZone, "HH:mm")}`;
}

export function clipInterval(interval: Interval, from: Date, to: Date): Interval | null {
  const start = interval.start < from ? from : interval.start;
  const end = interval.end > to ? to : interval.end;
  if (end <= start) return null;
  return { ...interval, start, end };
}

export function eachDateInZone(from: Date, to: Date, timeZone: string): string[] {
  const startStr = formatInTimeZone(from, timeZone, "yyyy-MM-dd");
  const endStr = formatInTimeZone(to, timeZone, "yyyy-MM-dd");
  const dates: string[] = [];
  let cursor = startStr;
  let guard = 0;
  while (cursor <= endStr && guard < 400) {
    dates.push(cursor);
    const next = addDays(fromZonedTime(`${cursor}T12:00:00`, timeZone), 1);
    cursor = formatInTimeZone(next, timeZone, "yyyy-MM-dd");
    guard += 1;
  }
  return dates;
}

export function localInterval(
  dateStr: string,
  startHm: string,
  endHm: string,
  timeZone: string,
): Interval {
  return {
    start: fromZonedTime(`${dateStr}T${startHm}:00`, timeZone),
    end: fromZonedTime(`${dateStr}T${endHm}:00`, timeZone),
  };
}

export function expandClassBlocks(
  blocks: Array<
    Pick<ClassBlock, "title" | "dayOfWeek" | "startTime" | "endTime"> & { location?: string | null }
  >,
  from: Date,
  to: Date,
  timeZone: string,
): Interval[] {
  const dates = eachDateInZone(from, to, timeZone);
  const result: Interval[] = [];
  for (const dateStr of dates) {
    const noon = fromZonedTime(`${dateStr}T12:00:00`, timeZone);
    const isoDay = getISODay(noon);
    for (const block of blocks) {
      if (block.dayOfWeek !== isoDay) continue;
      result.push({
        ...localInterval(dateStr, block.startTime, block.endTime, timeZone),
        title: block.title,
        kind: "class",
        location: block.location ?? null,
      });
    }
  }
  return result;
}

export function itemBusyIntervals(items: Item[]): Interval[] {
  const result: Interval[] = [];
  for (const item of items) {
    if (item.status !== "pending") continue;
    if (item.startAt && item.endAt) {
      result.push({
        start: item.startAt,
        end: item.endAt,
        title: item.title,
        kind: item.type,
      });
      continue;
    }
    if (item.startAt && item.durationMinutes) {
      result.push({
        start: item.startAt,
        end: new Date(item.startAt.getTime() + item.durationMinutes * 60_000),
        title: item.title,
        kind: item.type,
      });
      continue;
    }
    if (item.type === "exam" && item.dueAt) {
      const duration = item.durationMinutes ?? 120;
      result.push({
        start: item.dueAt,
        end: new Date(item.dueAt.getTime() + duration * 60_000),
        title: item.title,
        kind: "exam",
      });
    }
  }
  return result;
}

export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals]
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Interval[] = [];
  for (const current of sorted) {
    const last = merged[merged.length - 1];
    if (!last || current.start > last.end) {
      merged.push({ ...current });
    } else if (current.end > last.end) {
      last.end = current.end;
    }
  }
  return merged;
}

export function subtractBusy(windows: Interval[], busy: Interval[]): Interval[] {
  const mergedBusy = mergeIntervals(busy);
  const free: Interval[] = [];
  for (const window of windows) {
    let cursor = window.start;
    for (const block of mergedBusy) {
      if (block.end <= cursor || block.start >= window.end) continue;
      if (block.start > cursor) {
        free.push({
          start: cursor,
          end: block.start < window.end ? block.start : window.end,
          title: window.title,
          kind: window.kind,
        });
      }
      if (block.end > cursor) {
        cursor = block.end;
      }
      if (cursor >= window.end) break;
    }
    if (cursor < window.end) {
      free.push({ start: cursor, end: window.end, title: window.title, kind: window.kind });
    }
  }
  return free.filter((slot) => slot.end.getTime() - slot.start.getTime() >= MIN_GAP_MINUTES * 60_000);
}

export function workWindows(
  from: Date,
  to: Date,
  timeZone: string,
  workStart = AWAKE_START,
  workEnd = AWAKE_END,
): Interval[] {
  return eachDateInZone(from, to, timeZone).map((dateStr) =>
    localInterval(dateStr, workStart, workEnd, timeZone),
  );
}

export function dayPartWindows(from: Date, to: Date, timeZone: string): Interval[] {
  const windows: Interval[] = [];
  for (const dateStr of eachDateInZone(from, to, timeZone)) {
    for (const part of DAY_PARTS) {
      const raw = {
        ...localInterval(dateStr, part.start, part.end, timeZone),
        title: part.label,
        kind: part.id,
      };
      const clipped = clipInterval(raw, from, to);
      if (clipped) windows.push(clipped);
    }
  }
  return windows;
}

export function findFreeSlots(input: {
  from: Date;
  to: Date;
  timeZone: string;
  classBlocks: Pick<ClassBlock, "title" | "dayOfWeek" | "startTime" | "endTime">[];
  items: Item[];
  calendarBusy: Interval[];
}): FreeSlot[] {
  const windows = dayPartWindows(input.from, input.to, input.timeZone);
  const busy = [
    ...expandClassBlocks(input.classBlocks, input.from, input.to, input.timeZone),
    ...itemBusyIntervals(input.items),
    ...input.calendarBusy,
  ];
  return subtractBusy(windows, busy).map((slot) => {
    const minutes = Math.round((slot.end.getTime() - slot.start.getTime()) / 60_000);
    const partLabel = slot.title ?? partLabelFor(slot.start, input.timeZone);
    const rangeLabel = formatRange(slot.start, slot.end, input.timeZone);
    const date = formatInTimeZone(slot.start, input.timeZone, "yyyy-MM-dd");
    return {
      ...slot,
      minutes,
      date,
      partLabel,
      rangeLabel,
      label: `${formatInTimeZone(slot.start, input.timeZone, "EEE d MMM")} · ${partLabel} ${rangeLabel}`,
    };
  });
}

export function minutesBetween(startHm: string, endHm: string): number {
  const start = parseHm(startHm);
  const end = parseHm(endHm);
  return end.hours * 60 + end.minutes - (start.hours * 60 + start.minutes);
}
