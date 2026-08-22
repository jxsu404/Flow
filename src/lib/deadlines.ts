import { differenceInCalendarDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { Item } from "@/db/schema";

export type ActivityKind = "tarea" | "examen" | "proyecto" | "trabajo" | "entrega" | "evento";
export type UrgencyLevel = "urgent" | "soon" | "later";

export type Urgency = {
  level: UrgencyLevel;
  daysLeft: number;
  label: string;
};

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function activityKind(item: Pick<Item, "type" | "title">): ActivityKind {
  const text = fold(`${item.title} ${item.type}`);
  if (item.type === "exam" || text.includes("examen")) return "examen";
  if (item.type === "event") return "evento";
  if (/\bproyecto\b/.test(text)) return "proyecto";
  if (/\btrabajo\b/.test(text)) return "trabajo";
  if (item.type === "task" || /\btarea\b/.test(text)) return "tarea";
  return "entrega";
}

export const KIND_LABEL: Record<ActivityKind, string> = {
  tarea: "TAREA",
  examen: "EXAMEN",
  proyecto: "PROYECTO",
  trabajo: "TRABAJO",
  entrega: "ENTREGA",
  evento: "EVENTO",
};

export function daysUntilDue(dueAt: Date, today: string, timeZone: string): number {
  const due = formatInTimeZone(dueAt, timeZone, "yyyy-MM-dd");
  const dueNoon = fromZonedTime(`${due}T12:00:00`, timeZone);
  const todayNoon = fromZonedTime(`${today}T12:00:00`, timeZone);
  return differenceInCalendarDays(dueNoon, todayNoon);
}

export function urgencyForDue(dueAt: Date | null, today: string, timeZone: string): Urgency | null {
  if (!dueAt) return null;
  const daysLeft = daysUntilDue(dueAt, today, timeZone);
  if (daysLeft < 0) return { level: "urgent", daysLeft, label: "VENCIDA" };
  if (daysLeft === 0) return { level: "urgent", daysLeft, label: "HOY" };
  if (daysLeft === 1) return { level: "urgent", daysLeft, label: "MAÑANA" };
  if (daysLeft <= 3) return { level: "soon", daysLeft, label: `${daysLeft} DÍAS` };
  return { level: "later", daysLeft, label: `${daysLeft} DÍAS` };
}

export function dueCaption(item: Pick<Item, "type" | "dueAt">, urgency: Urgency | null): string {
  if (!urgency) return "Sin fecha";
  const noun = item.type === "exam" ? "Examen" : "Entrega";
  if (urgency.daysLeft < 0) return `${noun}: vencida`;
  if (urgency.daysLeft === 0) return `${noun}: hoy`;
  if (urgency.daysLeft === 1) return `${noun}: mañana`;
  return `${noun}: en ${urgency.daysLeft} días`;
}
