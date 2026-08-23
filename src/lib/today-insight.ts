import { formatInTimeZone } from "date-fns-tz";
import type { Item } from "@/db/schema";
import { activityKind, dueCaption, urgencyForDue, type ActivityKind } from "./deadlines";

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

export type TodayInsight = {
  tone: InsightTone;
  situation: InsightSituation;
  headline: string;
  detail: string;
  subject: InsightSubject | null;
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
  exam_today: 30,
  soon: 40,
  due_today: 50,
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

function workWord(kind: ActivityKind): "examen" | "evento" | "entrega" {
  if (kind === "examen") return "examen";
  if (kind === "evento") return "evento";
  return "entrega";
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

function classCount(busy: InsightBusy[]): number {
  return busy.filter(isClassBlock).length;
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
    if (kind === "examen" && date === today) return { situation: "exam_today", minutesLeft };
    if (pressure === "soon") return { situation: "soon", minutesLeft };
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

function overdueWhen(clock: Date, today: string, timeZone: string): string {
  const date = formatInTimeZone(clock, timeZone, "yyyy-MM-dd");
  const time = formatInTimeZone(clock, timeZone, "HH:mm");
  if (date === today) return `hoy a las ${time}`;
  return `el ${formatInTimeZone(clock, timeZone, "d MMM")} a las ${time}`;
}

function compose(input: {
  situation: InsightSituation;
  item?: InsightItem;
  block?: InsightBusy;
  today: string;
  timeZone: string;
  hasClasses: boolean;
  hasLaterWork: boolean;
}): { tone: InsightTone; headline: string; detail: string; subject: InsightSubject | null } {
  const { situation, item, block, today, timeZone, hasClasses, hasLaterWork } = input;
  const kind = item ? activityKind(item) : "entrega";
  const work = workWord(kind);
  const clock = item ? itemClock(item) : toDate(block?.start);
  const time = clock ? formatInTimeZone(clock, timeZone, "HH:mm") : "";
  const title = item?.title ?? block?.title ?? "";
  const subject = item ? subjectFromItem(item, today, timeZone) : null;

  switch (situation) {
    case "overdue":
      return {
        tone: "act",
        headline: work === "examen" ? "Tienes un examen vencido" : "Tienes una entrega vencida",
        detail: clock
          ? `${title} debía entregarse ${overdueWhen(clock, today, timeZone)} y todavía está pendiente.`
          : `${title} ya venció y todavía está pendiente.`,
        subject,
      };
    case "imminent":
      return {
        tone: "act",
        headline: kind === "examen" ? "Tu examen es ahora" : "Deberías terminarla ahora",
        detail:
          kind === "examen" || kind === "evento"
            ? `${title} es en menos de ${IMMINENT_MINUTES} minutos.`
            : `${title} vence en menos de ${IMMINENT_MINUTES} minutos.`,
        subject,
      };
    case "soon":
      return {
        tone: "watch",
        headline: kind === "examen" ? "Tu examen es pronto" : "No lo dejes para después",
        detail: time
          ? `${title} ${kind === "examen" ? "es" : "vence"} hoy a las ${time}.`
          : `${title} es hoy. No lo dejes para después.`,
        subject,
      };
    case "exam_today":
      return {
        tone: "watch",
        headline: "Tienes un examen hoy",
        detail: time ? `${title} es hoy a las ${time}.` : `${title} es hoy.`,
        subject,
      };
    case "due_today":
      return {
        tone: "watch",
        headline: "Tienes una entrega pendiente",
        detail: hasClasses
          ? time
            ? `Además de tus clases de hoy, tienes que entregar ${title} antes de las ${time}.`
            : "Además de tus clases de hoy, tienes una entrega pendiente."
          : "Aún tienes tiempo para entregarla hoy.",
        subject,
      };
    case "next_block":
      return {
        tone: "watch",
        headline: isClassBlock(block ?? { title: "", start: "", end: "" })
          ? "Tu clase empieza pronto"
          : "Tienes algo en unos minutos",
        detail: time ? `${title} empieza a las ${time}.` : `${title} empieza pronto.`,
        subject: null,
      };
    case "busy":
      return {
        tone: "occupied",
        headline: "Tienes un día ocupado",
        detail: hasLaterWork
          ? "Tienes actividades programadas, pero todavía puedes encontrar momentos para avanzar tus tareas."
          : "Hoy tienes actividades programadas.",
        subject: null,
      };
    case "later":
      return {
        tone: "watch",
        headline: "Tienes pendientes más adelante",
        detail: title
          ? `Lo más próximo es ${title}. Hoy no vence nada.`
          : "Hoy no vence nada, pero tienes pendientes en los próximos días.",
        subject,
      };
    case "cleared":
      return {
        tone: "calm",
        headline: "Ya cumpliste lo de hoy",
        detail: "No te queda nada pendiente por ahora.",
        subject: null,
      };
    case "free":
      return {
        tone: "calm",
        headline: "Tu día está libre",
        detail: "No tienes tareas, clases ni eventos importantes para hoy.",
        subject: null,
      };
  }
}

export function interpretToday(input: {
  now: Date;
  timeZone: string;
  items: InsightItem[];
  busy?: InsightBusy[];
}): TodayInsight {
  const today = formatInTimeZone(input.now, input.timeZone, "yyyy-MM-dd");
  const pending = input.items.filter(isPending);
  const busy = (input.busy ?? []).map((block) => ({
    ...block,
    start: toDate(block.start) ?? block.start,
    end: toDate(block.end) ?? block.end,
  }));
  const remaining = remainingBusy(busy, input.now);
  const hasClasses = classCount(busy) > 0;
  const next = nextBlock(busy, input.now);

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

  if (remaining.length > 0) {
    candidates.push({
      priority: INSIGHT_PRIORITY.busy,
      situation: "busy",
      tone: "occupied",
      minutesLeft: next?.minutesLeft,
    });
  } else if (busy.length > 0) {
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
    hasClasses,
    hasLaterWork,
  });

  return {
    tone: composed.tone,
    situation: chosen.situation,
    headline: composed.headline,
    detail: composed.detail,
    subject: composed.subject,
  };
}
