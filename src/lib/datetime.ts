import { addDays, addMonths, getISODay } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";

export const DEFAULT_TIMEZONE = "America/Costa_Rica";

export function parseUserDateTime(value: string, timeZone: string): Date {
  const trimmed = value.trim();
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed);
  }
  const normalized = trimmed.includes("T")
    ? trimmed.length === 16
      ? `${trimmed}:00`
      : trimmed
    : `${trimmed}T00:00:00`;
  return fromZonedTime(normalized, timeZone);
}

export function parseHm(value: string): { hours: number; minutes: number } {
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    throw new Error(`Hora inválida: ${value}`);
  }
  return { hours: h, minutes: m };
}

export const ISO_DAY_LABELS: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo",
};

export const ISO_DAY_ABBR: Record<number, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
  7: "Dom",
};

export const ISO_DAY_SHORT: Record<number, string> = {
  1: "MO",
  2: "TU",
  3: "WE",
  4: "TH",
  5: "FR",
  6: "SA",
  7: "SU",
};

export function weekDateRange(now: Date, timeZone: string): { start: Date; end: Date } {
  const today = formatInTimeZone(now, timeZone, "yyyy-MM-dd");
  const noon = fromZonedTime(`${today}T12:00:00`, timeZone);
  const mondayNoon = addDays(noon, -(getISODay(noon) - 1));
  const monday = formatInTimeZone(mondayNoon, timeZone, "yyyy-MM-dd");
  const sunday = formatInTimeZone(addDays(mondayNoon, 6), timeZone, "yyyy-MM-dd");
  return {
    start: fromZonedTime(`${monday}T00:00:00`, timeZone),
    end: fromZonedTime(`${sunday}T23:59:59`, timeZone),
  };
}

export function weekContaining(dateStr: string, timeZone: string): { start: Date; end: Date } {
  const noon = fromZonedTime(`${dateStr}T12:00:00`, timeZone);
  return weekDateRange(noon, timeZone);
}

export function monthGridRange(dateStr: string, timeZone: string): {
  start: Date;
  end: Date;
  month: string;
} {
  const noon = fromZonedTime(`${dateStr}T12:00:00`, timeZone);
  const month = formatInTimeZone(noon, timeZone, "yyyy-MM");
  const monthStart = fromZonedTime(`${month}-01T12:00:00`, timeZone);
  const leading = getISODay(monthStart) - 1;
  const gridStartNoon = addDays(monthStart, -leading);
  const gridEndNoon = addDays(gridStartNoon, 41);
  const startStr = formatInTimeZone(gridStartNoon, timeZone, "yyyy-MM-dd");
  const endStr = formatInTimeZone(gridEndNoon, timeZone, "yyyy-MM-dd");
  return {
    start: fromZonedTime(`${startStr}T00:00:00`, timeZone),
    end: fromZonedTime(`${endStr}T23:59:59`, timeZone),
    month,
  };
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function addCalendarDays(dateStr: string, amount: number, timeZone: string): string {
  const noon = fromZonedTime(`${dateStr}T12:00:00`, timeZone);
  return formatInTimeZone(addDays(noon, amount), timeZone, "yyyy-MM-dd");
}

export function addCalendarMonths(dateStr: string, amount: number, timeZone: string): string {
  const noon = fromZonedTime(`${dateStr}T12:00:00`, timeZone);
  return formatInTimeZone(addMonths(noon, amount), timeZone, "yyyy-MM-dd");
}

export function formatWeekSpan(start: Date, end: Date, timeZone: string): string {
  const startDay = formatInTimeZone(start, timeZone, "d", { locale: es });
  const endLabel = formatInTimeZone(end, timeZone, "d MMM", { locale: es });
  return `${startDay} – ${endLabel}`;
}

export function formatMonthTitle(dateStr: string, timeZone: string): string {
  const noon = fromZonedTime(`${dateStr}T12:00:00`, timeZone);
  const raw = formatInTimeZone(noon, timeZone, "MMMM yyyy", { locale: es });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function dayColumnLabel(dateStr: string, timeZone: string): { abbr: string; day: string } {
  const noon = fromZonedTime(`${dateStr}T12:00:00`, timeZone);
  return {
    abbr: ISO_DAY_ABBR[getISODay(noon)] ?? "",
    day: formatInTimeZone(noon, timeZone, "d"),
  };
}

export function parseDayOfWeek(value: string | number): number {
  if (typeof value === "number") {
    if (value >= 1 && value <= 7) return value;
    throw new Error("El día debe ser 1 (lunes) a 7 (domingo)");
  }
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const map: Record<string, number> = {
    lunes: 1,
    martes: 2,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
    domingo: 7,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 7,
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
  };
  const day = map[normalized];
  if (!day) throw new Error(`No reconocí el día: ${value}`);
  return day;
}
