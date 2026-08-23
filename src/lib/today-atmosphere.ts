import { formatInTimeZone } from "date-fns-tz";
import type { ClassBlock, Item } from "@/db/schema";
import { weatherEmoji, type WeatherMood, type WeatherSnapshot } from "./weather";

export type DayPart = "morning" | "afternoon" | "night";

export type TodayAtmosphere = {
  emoji: string | null;
  line: string;
};

const KIND_LABEL: Record<Item["type"], string> = {
  task: "tarea",
  assignment: "entrega",
  exam: "examen",
  event: "evento",
};

export function getDayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "night";
}

export function timeNoun(dayPart: DayPart): string {
  if (dayPart === "morning") return "mañana";
  if (dayPart === "afternoon") return "tarde";
  return "noche";
}

export function namedItem(item: Pick<Item, "type" | "title">): string {
  const kind = KIND_LABEL[item.type];
  const title = item.title.trim();
  if (!title) return kind;
  if (title.toLowerCase().includes(kind)) return title;
  return `${kind} de ${title}`;
}

export function duePhrase(dueAt: Date | null, now: Date, timeZone: string): string {
  if (!dueAt) return "hoy";
  const today = formatInTimeZone(now, timeZone, "yyyy-MM-dd");
  const dueDay = formatInTimeZone(dueAt, timeZone, "yyyy-MM-dd");
  if (dueDay !== today) return "pronto";
  const hour = Number(formatInTimeZone(dueAt, timeZone, "H"));
  if (hour >= 18) return "esta noche";
  if (hour >= 12) return "esta tarde";
  if (hour >= 5) return "esta mañana";
  return `a las ${formatInTimeZone(dueAt, timeZone, "HH:mm")}`;
}

function isOnCalendarDay(date: Date, now: Date, timeZone: string): boolean {
  return formatInTimeZone(date, timeZone, "yyyy-MM-dd") === formatInTimeZone(now, timeZone, "yyyy-MM-dd");
}

export function isUrgentItem(item: Item, now: Date, timeZone: string): boolean {
  if (item.status !== "pending") return false;
  const when = item.dueAt ?? item.startAt;
  if (!when) return false;
  const todayOrOverdue = isOnCalendarDay(when, now, timeZone) || when.getTime() < now.getTime();
  if (!todayOrOverdue) return false;
  return item.type === "exam" || item.type === "assignment" || item.priority === "high";
}

export function pickFocalItem(
  todayItems: Item[],
  priorities: Item[],
  now: Date,
  timeZone: string,
): Item | null {
  const seen = new Set<string>();
  const pool: Item[] = [];
  for (const item of [...todayItems, ...priorities]) {
    if (item.status !== "pending" || seen.has(item.id)) continue;
    seen.add(item.id);
    pool.push(item);
  }
  if (pool.length === 0) return null;

  const score = (item: Item) => {
    const when = item.dueAt ?? item.startAt;
    const onToday = when ? isOnCalendarDay(when, now, timeZone) : false;
    const overdue = when ? when.getTime() < now.getTime() : false;
    let points = 0;
    if (item.type === "exam" && (onToday || overdue)) points += 400;
    if (item.type === "assignment" && (onToday || overdue)) points += 300;
    if (item.priority === "high" && (onToday || overdue)) points += 200;
    if (overdue) points += 80;
    if (onToday) points += 50;
    if (item.priority === "high") points += 20;
    if (item.type === "exam") points += 10;
    const dueMs = item.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return points * 1e12 - dueMs;
  };

  return [...pool].sort((a, b) => score(b) - score(a))[0] ?? null;
}

function weatherTimePhrase(dayPart: DayPart, mood: WeatherMood, isDay: boolean): string {
  const time = timeNoun(dayPart);
  if (mood === "storm") {
    return dayPart === "night" ? "La noche está con tormenta" : `Una ${time} de tormenta`;
  }
  if (mood === "rain") {
    return dayPart === "night" ? "La noche está tranquila y lluviosa" : `Una ${time} lluviosa`;
  }
  if (mood === "snow") {
    return dayPart === "night" ? "La noche está nevada" : `Una ${time} nevada`;
  }
  if (mood === "fog") {
    return dayPart === "night" ? "La noche está con neblina" : `Una ${time} con neblina`;
  }
  if (mood === "cloudy") {
    return dayPart === "night" ? "La noche está nublada" : `Una ${time} nublada`;
  }
  if (!isDay || dayPart === "night") return "La noche está despejada";
  return `Una ${time} soleada`;
}

function joinWeather(phrase: string, rest: string): string {
  if (phrase.startsWith("Una")) return `${phrase} ${rest}`;
  return `${phrase}. ${rest}`;
}

function objectEnding(type: Item["type"]): "la" | "lo" {
  return type === "exam" || type === "event" ? "lo" : "la";
}

function deadlineLead(item: Pick<Item, "type" | "title">, phrase: string): string {
  const named = namedItem(item);
  if (item.type === "exam" || item.type === "event") {
    return `Tu ${named} es ${phrase}.`;
  }
  return `Tu ${named} vence ${phrase}.`;
}

function weatherSupport(dayPart: DayPart, mood: WeatherMood, type: Item["type"]): string {
  const time = timeNoun(dayPart);
  const ending = objectEnding(type);
  if (mood === "rain") {
    return `La ${time} lluviosa puede ser un buen momento para terminar${ending}.`;
  }
  if (mood === "storm") {
    return `Si puedes estar cubierto, es un buen momento para concentrarte y terminar${ending}.`;
  }
  if (mood === "clear") {
    return `Aprovecha esta ${time} para terminar${ending}.`;
  }
  return `Esta ${time} puede servir para terminar${ending}.`;
}

export function composeTodayAtmosphere(input: {
  dayPart: DayPart;
  weather: Pick<WeatherSnapshot, "mood" | "isDay"> | null;
  focal: Pick<Item, "type" | "title"> | null;
  urgent: boolean;
  duePhrase: string | null;
  nextClass: { title: string; startTime: string } | null;
}): TodayAtmosphere {
  const { dayPart, weather, focal, nextClass } = input;
  const time = timeNoun(dayPart);
  const emoji = weather ? weatherEmoji(weather.mood, weather.isDay) : null;

  if (focal && input.urgent) {
    const lead = deadlineLead(focal, input.duePhrase ?? "hoy");
    if (!weather) {
      return { emoji, line: `${lead} Aún puedes avanzar y terminar${objectEnding(focal.type)}.` };
    }
    return { emoji, line: `${lead} ${weatherSupport(dayPart, weather.mood, focal.type)}` };
  }

  if (weather) {
    const sky = weatherTimePhrase(dayPart, weather.mood, weather.isDay);
    if (focal) {
      const named = namedItem(focal);
      if (sky.startsWith("Una")) {
        return { emoji, line: joinWeather(sky, `perfecta para avanzar en tu ${named}.`) };
      }
      return { emoji, line: `${sky}. Buen momento para terminar tu ${named}.` };
    }
    if (nextClass) {
      return { emoji, line: `${sky}. A las ${nextClass.startTime} tienes ${nextClass.title}.` };
    }
    if (sky.startsWith("Una") && weather.mood === "clear" && weather.isDay) {
      return { emoji, line: joinWeather(sky, "para empezar con calma.") };
    }
    if (sky.startsWith("Una")) {
      return { emoji, line: joinWeather(sky, "perfecta para avanzar en lo pendiente.") };
    }
    return { emoji, line: `${sky}. Buen momento para terminar lo que tienes pendiente.` };
  }

  if (focal) {
    return {
      emoji,
      line: `Tienes una ${time} tranquila. Aún puedes avanzar en tu ${namedItem(focal)}.`,
    };
  }
  if (nextClass) {
    return {
      emoji,
      line: `Tienes una ${time} tranquila. A las ${nextClass.startTime} tienes ${nextClass.title}.`,
    };
  }
  return {
    emoji,
    line: `Tienes una ${time} tranquila. Aún puedes avanzar en lo pendiente.`,
  };
}

export function buildTodayAtmosphere(input: {
  now: Date;
  timeZone: string;
  weather: WeatherSnapshot | null;
  todayItems: Item[];
  priorities: Item[];
  todayClasses: Array<Pick<ClassBlock, "title" | "startTime">>;
}): TodayAtmosphere {
  const hour = Number(formatInTimeZone(input.now, input.timeZone, "H"));
  const dayPart = getDayPart(Number.isFinite(hour) ? hour : 12);
  const focal = pickFocalItem(input.todayItems, input.priorities, input.now, input.timeZone);
  const urgent = focal ? isUrgentItem(focal, input.now, input.timeZone) : false;
  const nextClass = input.todayClasses[0]
    ? { title: input.todayClasses[0].title, startTime: input.todayClasses[0].startTime }
    : null;

  return composeTodayAtmosphere({
    dayPart,
    weather: input.weather,
    focal,
    urgent,
    duePhrase: focal ? duePhrase(focal.dueAt ?? focal.startAt, input.now, input.timeZone) : null,
    nextClass: focal ? null : nextClass,
  });
}
