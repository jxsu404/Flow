import { getISODay } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { Item } from "@/db/schema";
import { DAY_PARTS, localInterval, type DayPartId } from "./availability";
import { activityKind, dueCaption, urgencyForDue, type ActivityKind } from "./deadlines";
import { ISO_DAY_LABELS } from "./datetime";
import { composeTodayPhrase, type WeatherHint } from "./today-phrase";

/** Minutes left before a deadline counts as “do it now”, not as a scare. */
export const IMMINENT_MINUTES = 30;
/** Minutes left before a deadline counts as “don’t leave it”. 21:30 → 23:59 is inside this window. */
export const SOON_MINUTES = 180;

export type InsightTone = "calm" | "watch" | "act" | "occupied";

export type InsightSituation =
  | "overdue"
  | "imminent"
  | "soon"
  | "exam_today"
  | "due_today"
  | "next_block"
  | "busy"
  | "later"
  | "cleared"
  | "free";

export type DuePressure = "overdue" | "imminent" | "soon" | "comfortable";

export type InsightSubject = {
  id: string;
  title: string;
  meta: string;
  href: string;
  cta: string;
};

export type DayPartPhase = "early" | "active" | "windingDown";

export type TodayPart = {
  id: DayPartId;
  label: "Mañana" | "Tarde" | "Noche";
  rangeLabel: string;
  phase: DayPartPhase;
};

export type TodayInsight = {
  tone: InsightTone;
  situation: InsightSituation;
  headline: string;
  detail: string;
  subject: InsightSubject | null;
  part: TodayPart;
};

export type InsightItem = Pick<Item, "id" | "title" | "type" | "status" | "dueAt" | "startAt">;

export type InsightBusy = {
  title: string;
  kind?: string | null;
  start: Date | string;
  end: Date | string;
};

type Candidate = {
  priority: number;
  situation: InsightSituation;
  tone: InsightTone;
  item?: InsightItem;
  block?: InsightBusy;
  minutesLeft?: number;
};

/** Room between ranks so later situations can be inserted without reshuffling. */
export const INSIGHT_PRIORITY: Record<InsightSituation, number> = {
  overdue: 10,
  imminent: 20,
  soon: 30,
  due_today: 40,
  exam_today: 50,
  next_block: 60,
  busy: 70,
  later: 80,
  cleared: 85,
  free: 90,
};

export function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function minutesUntil(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 60_000);
}

export function duePressure(minutesLeft: number): DuePressure {
  if (minutesLeft < 0) return "overdue";
  if (minutesLeft <= IMMINENT_MINUTES) return "imminent";
  if (minutesLeft <= SOON_MINUTES) return "soon";
  return "comfortable";
}

export function resolveDayPart(now: Date, timeZone: string): TodayPart {
  const hm = formatInTimeZone(now, timeZone, "HH:mm");
  if (hm < "07:00") {
    return { id: "evening", label: "Noche", rangeLabel: "18:00 – 22:00", phase: "early" };
  }
  if (hm >= "22:00") {
    return { id: "evening", label: "Noche", rangeLabel: "18:00 – 22:00", phase: "windingDown" };
  }
  const part = DAY_PARTS.find((item) => hm >= item.start && hm < item.end) ?? DAY_PARTS[2];
  return {
    id: part.id,
    label: part.label,
    rangeLabel: `${part.start} – ${part.end}`,
    phase: "active",
  };
}

function partWindow(now: Date, timeZone: string, part: TodayPart): { start: Date; end: Date } {
  const today = formatInTimeZone(now, timeZone, "yyyy-MM-dd");
  if (part.phase === "early") return localInterval(today, "00:00", "07:00", timeZone);
  if (part.phase === "windingDown") {
    return {
      start: fromZonedTime(`${today}T22:00:00`, timeZone),
      end: fromZonedTime(`${today}T23:59:59`, timeZone),
    };
  }
  const def = DAY_PARTS.find((item) => item.id === part.id) ?? DAY_PARTS[2];
  return localInterval(today, def.start, def.end, timeZone);
}

function overlaps(block: InsightBusy, from: Date, to: Date): boolean {
  const start = toDate(block.start);
  const end = toDate(block.end);
  if (!start || !end) return false;
  return start < to && end > from;
}

function itemClock(item: InsightItem): Date | null {
  return toDate(item.dueAt) ?? toDate(item.startAt);
}

function isPending(item: InsightItem): boolean {
  return item.status === "pending";
}

function isClassBlock(block: InsightBusy): boolean {
  return (block.kind ?? "") === "class";
}

function ctaFor(kind: ActivityKind): string {
  if (kind === "examen") return "Ver examen";
  if (kind === "evento") return "Ver evento";
  return "Ver tarea";
}

function subjectFromItem(item: InsightItem, today: string, timeZone: string): InsightSubject {
  const kind = activityKind(item);
  const clock = itemClock(item);
  const urgency = urgencyForDue(toDate(item.dueAt), today, timeZone);
  const caption = item.dueAt ? dueCaption(item, urgency) : kind === "evento" ? "Evento hoy" : "Hoy";
  const time = clock ? formatInTimeZone(clock, timeZone, "HH:mm") : null;
  return {
    id: item.id,
    title: item.title,
    meta: time ? `${caption} · ${time}` : caption,
    href: `/app/tareas#item-${item.id}`,
    cta: ctaFor(kind),
  };
}

function remainingBusy(busy: InsightBusy[], now: Date): InsightBusy[] {
  return busy.filter((block) => {
    const end = toDate(block.end);
    return end != null && end.getTime() > now.getTime();
  });
}

function nextBlock(busy: InsightBusy[], now: Date): { block: InsightBusy; minutesLeft: number } | null {
  const upcoming = busy
    .map((block) => {
      const start = toDate(block.start);
      if (!start || start.getTime() <= now.getTime()) return null;
      return { block, minutesLeft: minutesUntil(now, start) };
    })
    .filter((row): row is { block: InsightBusy; minutesLeft: number } => row != null)
    .sort((a, b) => a.minutesLeft - b.minutesLeft);
  return upcoming[0] ?? null;
}

function situationForItem(
  item: InsightItem,
  now: Date,
  today: string,
  timeZone: string,
): { situation: InsightSituation; minutesLeft: number } | null {
  const due = toDate(item.dueAt);
  const start = toDate(item.startAt);
  const kind = activityKind(item);

  if (due) {
    const minutesLeft = minutesUntil(now, due);
    const pressure = duePressure(minutesLeft);
    const date = formatInTimeZone(due, timeZone, "yyyy-MM-dd");
    if (pressure === "overdue" || date < today) return { situation: "overdue", minutesLeft };
    if (pressure === "imminent") return { situation: "imminent", minutesLeft };
    if (pressure === "soon") return { situation: "soon", minutesLeft };
    if (kind === "examen" && date === today) return { situation: "exam_today", minutesLeft };
    if (date === today) return { situation: "due_today", minutesLeft };
    return { situation: "later", minutesLeft };
  }

  if (kind === "examen" && start) {
    const minutesLeft = minutesUntil(now, start);
    const date = formatInTimeZone(start, timeZone, "yyyy-MM-dd");
    if (date < today) return { situation: "overdue", minutesLeft };
    if (date > today) return { situation: "later", minutesLeft };
    if (duePressure(minutesLeft) === "imminent") return { situation: "imminent", minutesLeft };
    if (duePressure(minutesLeft) === "soon") return { situation: "soon", minutesLeft };
    return { situation: "exam_today", minutesLeft };
  }

  if (!due && !start) return { situation: "later", minutesLeft: Number.POSITIVE_INFINITY };
  return null;
}

function pickCandidate(candidates: Candidate[]): Candidate {
  return [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const aMin = a.minutesLeft ?? Number.POSITIVE_INFINITY;
    const bMin = b.minutesLeft ?? Number.POSITIVE_INFINITY;
    return aMin - bMin;
  })[0]!;
}

function situationTone(situation: InsightSituation): InsightTone {
  if (situation === "overdue" || situation === "imminent") return "act";
  if (situation === "busy") return "occupied";
  if (situation === "free" || situation === "cleared") return "calm";
  return "watch";
}

function compose(input: {
  situation: InsightSituation;
  item?: InsightItem;
  block?: InsightBusy;
  today: string;
  timeZone: string;
  now: Date;
  part: TodayPart;
  quietPart: boolean;
  partBusyTitles: string[];
  remainingClassTitles: string[];
  hasLaterWork: boolean;
  doneTodayCount: number;
  pendingCount: number;
  weather: WeatherHint | null;
}): { tone: InsightTone; headline: string; detail: string; subject: InsightSubject | null } {
  const { situation, item, block, today, timeZone, now, part } = input;
  const clock = item ? itemClock(item) : toDate(block?.start);
  const timeLabel = clock ? formatInTimeZone(clock, timeZone, "HH:mm") : "";
  const title = item?.title ?? block?.title ?? "";
  const subject = item ? subjectFromItem(item, today, timeZone) : null;
  const weekday = ISO_DAY_LABELS[getISODay(fromZonedTime(`${today}T12:00:00`, timeZone))] ?? "";
  const hour = Number(formatInTimeZone(now, timeZone, "H"));
  const minutesLeft = clock ? minutesUntil(now, clock) : null;
  const phrase = composeTodayPhrase({
    situation,
    part,
    weekday,
    hour,
    today,
    title,
    kind: item ? activityKind(item) : null,
    timeLabel,
    minutesLeft,
    quietPart: input.quietPart,
    partBusyTitles: input.partBusyTitles,
    remainingClassTitles: input.remainingClassTitles,
    hasLaterWork: input.hasLaterWork,
    doneTodayCount: input.doneTodayCount,
    pendingCount: input.pendingCount,
    weather: input.weather,
  });

  return {
    tone: situationTone(situation),
    headline: phrase,
    detail: "",
    subject,
  };
}

export function interpretToday(input: {
  now: Date;
  timeZone: string;
  items: InsightItem[];
  busy?: InsightBusy[];
  weather?: WeatherHint | null;
}): TodayInsight {
  const today = formatInTimeZone(input.now, input.timeZone, "yyyy-MM-dd");
  const part = resolveDayPart(input.now, input.timeZone);
  const window = partWindow(input.now, input.timeZone, part);
  const pending = input.items.filter(isPending);
  const busy = (input.busy ?? []).map((block) => ({
    ...block,
    start: toDate(block.start) ?? block.start,
    end: toDate(block.end) ?? block.end,
  }));
  const inPart = busy.filter((block) => overlaps(block, window.start, window.end));
  const remainingInPart = remainingBusy(inPart, input.now);
  const remainingClasses = remainingBusy(
    busy.filter(isClassBlock),
    input.now,
  );
  const next = nextBlock(busy, input.now);
  const nextInPart = next && overlaps(next.block, window.start, window.end) ? next : null;
  const doneTodayCount = input.items.filter((item) => {
    if (item.status !== "done") return false;
    const clock = itemClock(item);
    if (!clock) return false;
    return formatInTimeZone(clock, input.timeZone, "yyyy-MM-dd") === today;
  }).length;

  const candidates: Candidate[] = [];

  for (const item of pending) {
    const ranked = situationForItem(item, input.now, today, input.timeZone);
    if (!ranked) continue;
    candidates.push({
      priority: INSIGHT_PRIORITY[ranked.situation],
      situation: ranked.situation,
      tone: "watch",
      item,
      minutesLeft: ranked.minutesLeft,
    });
  }

  if (next && next.minutesLeft <= IMMINENT_MINUTES) {
    candidates.push({
      priority: INSIGHT_PRIORITY.next_block,
      situation: "next_block",
      tone: "watch",
      block: next.block,
      minutesLeft: next.minutesLeft,
    });
  }

  if (remainingInPart.length > 0) {
    candidates.push({
      priority: INSIGHT_PRIORITY.busy,
      situation: "busy",
      tone: "occupied",
      minutesLeft: nextInPart?.minutesLeft,
    });
  } else if (inPart.length > 0) {
    candidates.push({
      priority: INSIGHT_PRIORITY.cleared,
      situation: "cleared",
      tone: "calm",
    });
  }

  candidates.push({
    priority: INSIGHT_PRIORITY.free,
    situation: "free",
    tone: "calm",
  });

  const chosen = pickCandidate(candidates);
  const hasLaterWork = pending.some((item) => {
    const ranked = situationForItem(item, input.now, today, input.timeZone);
    return ranked?.situation === "later";
  });
  const composed = compose({
    situation: chosen.situation,
    item: chosen.item,
    block: chosen.block,
    today,
    timeZone: input.timeZone,
    now: input.now,
    part,
    quietPart: remainingInPart.length === 0,
    partBusyTitles: remainingInPart.map((block) => block.title),
    remainingClassTitles: remainingClasses.map((block) => block.title),
    hasLaterWork,
    doneTodayCount,
    pendingCount: pending.length,
    weather: input.weather ?? null,
  });

  return {
    tone: composed.tone,
    situation: chosen.situation,
    headline: composed.headline,
    detail: composed.detail,
    subject: composed.subject,
    part,
  };
}
