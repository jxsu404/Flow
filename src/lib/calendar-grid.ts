import type { ScheduleDay, ScheduleSegment } from "@/lib/day-plan";
import { subjectTone, type SubjectTone } from "@/lib/subject-color";

export const GRID_START_HOUR = 8;
export const GRID_END_HOUR = 22;
export const HOUR_HEIGHT = 48;
export const AWAKE_START_HOUR = 7;

export type CalendarBlock = {
  date: string;
  title: string;
  kind: string;
  location?: string | null;
  rangeLabel: string;
  startMin: number;
  durationMin: number;
};

export function gridHours(): number[] {
  const hours: number[] = [];
  for (let hour = GRID_START_HOUR; hour < GRID_END_HOUR; hour += 1) hours.push(hour);
  return hours;
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function clockRange(startMin: number, durationMin: number): string {
  const start = AWAKE_START_HOUR * 60 + startMin;
  const end = start + durationMin;
  const fmt = (mins: number) =>
    `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

export function busyBlocksFromDay(day: ScheduleDay): CalendarBlock[] {
  const busy = day.parts
    .flatMap((part) => part.segments)
    .filter((segment): segment is ScheduleSegment & { type: "busy" } => segment.type === "busy")
    .sort((a, b) => a.startMin - b.startMin);

  const merged: CalendarBlock[] = [];
  for (const segment of busy) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.title === segment.title &&
      last.kind === (segment.kind ?? "event") &&
      last.startMin + last.durationMin === segment.startMin
    ) {
      last.durationMin += segment.durationMin;
      last.rangeLabel = clockRange(last.startMin, last.durationMin);
      if (!last.location && segment.location) last.location = segment.location;
      continue;
    }
    merged.push({
      date: day.date,
      title: segment.title,
      kind: segment.kind ?? "event",
      location: segment.location,
      rangeLabel: segment.rangeLabel,
      startMin: segment.startMin,
      durationMin: segment.durationMin,
    });
  }
  return merged;
}

export function blockLayout(block: CalendarBlock): { top: number; height: number; hidden: boolean } {
  const gridStartMin = (GRID_START_HOUR - AWAKE_START_HOUR) * 60;
  const gridEndMin = (GRID_END_HOUR - AWAKE_START_HOUR) * 60;
  const start = Math.max(block.startMin, gridStartMin);
  const end = Math.min(block.startMin + block.durationMin, gridEndMin);
  if (end <= start) return { top: 0, height: 0, hidden: true };
  return {
    top: ((start - gridStartMin) / 60) * HOUR_HEIGHT,
    height: Math.max(28, ((end - start) / 60) * HOUR_HEIGHT),
    hidden: false,
  };
}

export function occupancy(day: ScheduleDay): { busyMin: number; freeMin: number; pct: number } {
  let busyMin = 0;
  let freeMin = 0;
  for (const part of day.parts) {
    for (const segment of part.segments) {
      if (segment.type === "busy") busyMin += segment.durationMin;
      else freeMin += segment.durationMin;
    }
  }
  const total = busyMin + freeMin;
  return {
    busyMin,
    freeMin,
    pct: total === 0 ? 0 : Math.round((busyMin / total) * 100),
  };
}

export type LegendItem = {
  key: string;
  label: string;
  tone: SubjectTone;
};

export function legendFromDays(days: ScheduleDay[]): LegendItem[] {
  const seen = new Map<string, LegendItem>();
  for (const day of days) {
    for (const block of busyBlocksFromDay(day)) {
      const tone = subjectTone(block.title, block.kind);
      const label =
        block.kind === "class"
          ? block.title
          : tone.label ?? block.title;
      const key = block.kind === "class" ? `class:${block.title}` : tone.key;
      if (!seen.has(key)) seen.set(key, { key, label, tone });
    }
  }
  return [...seen.values()];
}

export function dayHasBusy(day: ScheduleDay): boolean {
  return day.parts.some((part) => part.segments.some((segment) => segment.type === "busy"));
}

export const GRID_START_MIN = (GRID_START_HOUR - AWAKE_START_HOUR) * 60;
export const GRID_SPAN_MIN = (GRID_END_HOUR - GRID_START_HOUR) * 60;

export function nowLineTopFromClock(hour: number, minute: number): number | null {
  const current = hour * 60 + minute;
  const start = GRID_START_HOUR * 60;
  const end = GRID_END_HOUR * 60;
  if (current < start || current >= end) return null;
  return ((current - start) / 60) * HOUR_HEIGHT;
}

export function awakeStartMinFromClock(hour: number, minute: number): number {
  return hour * 60 + minute - AWAKE_START_HOUR * 60;
}

export function formatMinutesLabel(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

export function weekStats(
  days: ScheduleDay[],
  today: string,
  nowStartMin: number,
): { classTotal: number; classDone: number; freeMin: number; busyMin: number } {
  let classTotal = 0;
  let classDone = 0;
  let freeMin = 0;
  let busyMin = 0;
  for (const day of days) {
    const stats = occupancy(day);
    freeMin += stats.freeMin;
    busyMin += stats.busyMin;
    for (const block of busyBlocksFromDay(day)) {
      if (block.kind !== "class") continue;
      classTotal += 1;
      const end = block.startMin + block.durationMin;
      if (day.date < today || (day.date === today && end <= nowStartMin)) classDone += 1;
    }
  }
  return { classTotal, classDone, freeMin, busyMin };
}

export function daySegments(day: ScheduleDay): ScheduleSegment[] {
  return day.parts.flatMap((part) => part.segments);
}
