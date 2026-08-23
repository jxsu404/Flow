import type { ActivityKind } from "./deadlines";
import type { InsightSituation, TodayPart } from "./today-insight";
import type { WeatherCondition } from "./weather";

/** Optional weather. Omit entirely when Flow has no forecast — never invent rain, sun, or temperature. */
export type WeatherHint = {
  condition: WeatherCondition;
  temperatureC?: number;
};

export type PhraseFacts = {
  situation: InsightSituation;
  part: TodayPart;
  weekday: string;
  hour: number;
  today: string;
  title: string;
  kind: ActivityKind | null;
  timeLabel: string;
  minutesLeft: number | null;
  quietPart: boolean;
  partBusyTitles: string[];
  remainingClassTitles: string[];
  hasLaterWork: boolean;
  doneTodayCount: number;
  pendingCount: number;
  weather: WeatherHint | null;
};

export function pickVariant<T>(variants: readonly T[], seed: string): T {
  if (variants.length === 0) {
    throw new Error("pickVariant needs at least one option");
  }
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return variants[Math.abs(hash) % variants.length]!;
}

function slot(part: TodayPart): string {
  return part.label.toLowerCase();
}

function rainy(weather: WeatherHint | null): boolean {
  return weather?.condition === "rain" || weather?.condition === "storm";
}

function joinNames(names: string[]): string {
  const unique = [...new Set(names.filter(Boolean))];
  if (unique.length <= 1) return unique[0] ?? "";
  if (unique.length === 2) return `${unique[0]} y ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")} y ${unique.at(-1)}`;
}

function dueWhen(facts: PhraseFacts): string {
  if (!facts.timeLabel) return "hoy";
  if (facts.timeLabel >= "18:00") return "esta noche";
  if (facts.timeLabel >= "12:00") return "esta tarde";
  return "esta mañana";
}

function restOfPart(part: TodayPart): string {
  if (part.phase === "windingDown") return "el resto de la noche";
  return `el resto de tu ${slot(part)}`;
}

function hoursLeft(minutesLeft: number | null): number | null {
  if (minutesLeft == null || minutesLeft <= 0) return null;
  return Math.max(1, Math.round(minutesLeft / 60));
}

function hoursPhrase(minutesLeft: number | null): string | null {
  const hours = hoursLeft(minutesLeft);
  if (hours == null) return null;
  if (hours === 1) return "una hora";
  return `${hours} horas`;
}

function isWorkKind(kind: ActivityKind | null): boolean {
  return kind === "tarea" || kind === "entrega" || kind === "proyecto" || kind === "trabajo" || kind == null;
}

function quietAdj(facts: PhraseFacts): string {
  return facts.weather?.condition === "rain" || facts.weather?.condition === "storm"
    ? "lluviosa"
    : "tranquila";
}

function weekendLead(weekday: string): string | null {
  if (weekday === "Sábado" || weekday === "Domingo") return `Es ${weekday.toLowerCase()}`;
  return null;
}

export function phraseSeed(facts: PhraseFacts): string {
  return [facts.today, String(facts.hour), facts.situation, facts.title, facts.part.id].join("|");
}

export function greetingFor(part: TodayPart): string {
  if (part.id === "morning") return "Buenos días";
  if (part.id === "afternoon") return "Buenas tardes";
  return "Buenas noches";
}

function weatherMood(part: TodayPart, weather: WeatherHint | null, quiet: boolean): string[] {
  const name = slot(part);
  const temp =
    weather?.temperatureC != null && Number.isFinite(weather.temperatureC)
      ? ` a ${Math.round(weather.temperatureC)}°`
      : "";
  if (rainy(weather)) {
    return quiet
      ? [`Una ${name} lluviosa${temp}`, `Una ${name} lluviosa y tranquila${temp}`]
      : [`Una ${name} lluviosa${temp}`];
  }
  if (weather?.condition === "clear" && quiet) {
    return part.id === "evening"
      ? [`Una ${name} despejada y tranquila${temp}`]
      : [`Una ${name} soleada y tranquila${temp}`, `Una ${name} despejada${temp}`];
  }
  if (quiet) {
    return [`Una ${name} tranquila`, `La ${name} está tranquila`, `Tienes una ${name} bastante libre`];
  }
  return [];
}

function attachTitle(lead: string, title: string, facts: PhraseFacts): string {
  if (rainy(facts.weather)) {
    if (facts.part.id === "afternoon") {
      return `${lead} perfecta para avanzar en ${title} antes de que llegue la noche.`;
    }
    if (facts.part.id === "evening") {
      return `${lead}. Puedes aprovechar para dejar ${title} lista.`;
    }
    return `${lead} perfecta para avanzar en ${title}.`;
  }
  if (lead.startsWith("Tienes")) {
    return `${lead}. Buen momento para adelantar ${title}.`;
  }
  if (lead.startsWith("La ")) {
    return `${lead}. Puedes aprovecharla para avanzar un poco en ${title}.`;
  }
  if (facts.part.id === "afternoon") {
    return `${lead} para avanzar en ${title} antes de que llegue la noche.`;
  }
  return `${lead} para avanzar en ${title}.`;
}

export function phraseOptions(facts: PhraseFacts): string[] {
  const title = facts.title.trim();
  const classes = joinNames(facts.partBusyTitles);
  const laterClasses = joinNames(facts.remainingClassTitles);
  const name = slot(facts.part);
  const mood = weatherMood(facts.part, facts.weather, facts.quietPart);
  const left = hoursPhrase(facts.minutesLeft);
  const weekend = weekendLead(facts.weekday);

  const options = (() => {
    switch (facts.situation) {
      case "overdue":
        if (!title) return ["Tienes una entrega vencida y todavía está pendiente."];
        return [
          `${title} ya venció y sigue pendiente.`,
          `Tienes una entrega vencida: ${title}.`,
          `${title} debía entregarse y todavía no está lista.`,
        ];
      case "imminent":
        if (!title) return ["Queda muy poco tiempo. Conviene cerrar lo pendiente ahora."];
        if (facts.kind === "examen") {
          return [`${title} es en minutos. Conviene estar listo ahora.`];
        }
        return [
          `Deberías terminar ${title} ahora. Queda muy poco tiempo.`,
          `${title} vence en minutos. Este es el momento de cerrarla.`,
        ];
      case "soon": {
        if (!title) return ["Se acerca un plazo. Este sería un buen momento para avanzar."];
        if (facts.kind === "examen") {
          return [
            `Se acerca ${title}. Este sería un buen momento para repasarlo.`,
            `${title} es ${dueWhen(facts)}. Conviene ir repasando.`,
          ];
        }
        const lines = [
          `No lo dejes para después. ${title} vence ${dueWhen(facts)}.`,
          `Tu entrega de ${title} se acerca. Este sería un buen momento para avanzar.`,
          `${title} vence ${dueWhen(facts)}. Mejor no dejarlo para el final.`,
        ];
        if (mood[0]) {
          lines.push(`${mood[0]}. ${title} vence ${dueWhen(facts)}. Este sería un buen momento para avanzar.`);
        }
        if (left && (facts.minutesLeft ?? 0) <= 360) {
          lines.push(`Quedan ${left} para ${title}. No lo dejes para después.`);
        }
        return lines;
      }
      case "exam_today":
        if (!title) return ["Tienes un examen hoy. Conviene tenerlo presente."];
        return facts.timeLabel
          ? [
              `${title} es hoy a las ${facts.timeLabel}. Conviene tenerlo presente.`,
              `Hoy tienes ${title} a las ${facts.timeLabel}.`,
            ]
          : [`Tienes ${title} hoy. Conviene tenerlo presente.`];
      case "due_today": {
        if (!title) return ["Tienes una entrega pendiente para hoy."];
        if (facts.part.phase === "windingDown") {
          return [
            `El día está terminando y ${title} sigue pendiente.`,
            `Aún estás a tiempo de dejar ${title} lista antes de que cierre el día.`,
          ];
        }
        if (facts.part.phase === "early") {
          return [`Todavía es de madrugada. ${title} vence hoy.`];
        }
        if (!facts.quietPart && classes) {
          const lines = [
            `Esta ${name} tienes ${classes}. Si puedes, adelanta un poco ${title}.`,
            `${title} sigue pendiente para hoy, además de ${classes}.`,
          ];
          if (left && (facts.minutesLeft ?? 0) >= 120) {
            lines.push(`Después de ${classes} todavía tienes tiempo para ${title}.`);
          }
          if (mood[0]) {
            return [
              `${mood[0]}. Después de ${classes} puedes avanzar en ${title}.`,
              `${mood[0]} con ${classes}. Aún así puedes adelantar ${title}.`,
              ...lines.slice(0, 1),
            ];
          }
          return lines;
        }
        const timed = [`Aún tienes tiempo para entregar ${title} hoy.`];
        if (left && (facts.minutesLeft ?? 0) >= 120 && (facts.minutesLeft ?? 0) <= 720) {
          timed.push(`Aún tienes tiempo para entregar ${title} hoy. Quedan unas ${left}.`);
        }
        if (facts.pendingCount >= 3) {
          timed.push(`Tienes varias cosas pendientes. Empieza por ${title}.`);
        }
        if (weekend) {
          timed.push(`${weekend}. Aún tienes tiempo para entregar ${title} hoy.`);
        }
        const enriched = mood.map((lead) => attachTitle(lead, title, facts));
        const night =
          facts.part.id === "evening"
            ? [
                `La noche está ${quietAdj(facts)}. Puedes aprovechar para dejar ${title} lista.`,
                `Ya es de noche y ${title} sigue pendiente. Buen momento para cerrarla.`,
              ]
            : [];
        // Con clima real, las variantes que lo mencionan van primero: el dato existe y aporta contexto.
        if (facts.weather && enriched.length) {
          return [...enriched, ...night.slice(0, 1), timed[0]!];
        }
        return [...night, ...enriched, ...timed];
      }
      case "next_block":
        if (!title) return ["Tienes algo en unos minutos."];
        if (facts.kind === "examen") {
          return [`${title} empieza en unos minutos.`, `Está por comenzar ${title}.`];
        }
        if (facts.remainingClassTitles.includes(title) || facts.partBusyTitles.includes(title)) {
          return [`Tu clase de ${title} está por comenzar.`, `${title} empieza en unos minutos.`];
        }
        return [`${title} empieza en unos minutos.`, `Está por comenzar ${title}.`];
      case "busy":
        if (!classes) return [`Tu ${name} tiene actividades programadas.`];
        if (facts.hasLaterWork) {
          return [
            `Esta ${name} tienes ${classes}. Más tarde puedes avanzar en lo pendiente.`,
            `Hoy sigue ${classes}. Cuando se libere un hueco, puedes adelantar una tarea.`,
          ];
        }
        return [
          `Esta ${name} tienes ${classes}.`,
          laterClasses && laterClasses !== classes
            ? `Ahora tienes ${classes}. Más adelante sigue ${laterClasses}.`
            : `Hoy tienes ${classes} en tu ${name}.`,
        ].filter(Boolean);
      case "later":
        if (!title) {
          return [
            `No tienes pendientes importantes ahora. Disfruta ${restOfPart(facts.part)}.`,
            `Tu ${name} está tranquila. Nada urgente por ahora.`,
          ];
        }
        if (isWorkKind(facts.kind)) {
          const lines = [
            `Hoy no vence nada. Si quieres, puedes adelantar ${title}.`,
            `Nada vence hoy. ${title} puede esperar, o puedes adelantarla un poco.`,
          ];
          if (mood[0]) {
            lines.push(`${mood[0]}. Si quieres, puedes adelantar ${title}.`);
          }
          return lines;
        }
        return [
          `Hoy no vence nada. ${title} puede esperar.`,
          `Nada urgente por ahora. ${title} queda para más adelante.`,
        ];
      case "cleared":
      case "free": {
        if (facts.doneTodayCount > 0) {
          return [
            `Ya dejaste listo lo de hoy. Disfruta ${restOfPart(facts.part)}.`,
            `Lo de hoy ya está. Puedes tomarte ${restOfPart(facts.part)} con calma.`,
          ];
        }
        const enjoy = [
          `No tienes pendientes importantes ahora. Disfruta ${restOfPart(facts.part)}.`,
          `Tu ${name} está tranquila. Nada urgente por ahora.`,
        ];
        if (mood.length && facts.weather) {
          const lines = mood.map((lead) => `${lead}. Nada urgente por ahora.`);
          if (facts.weather.condition === "clear" && facts.part.id !== "evening") {
            lines.push(`Una ${name} soleada para empezar con calma.`);
          }
          if (rainy(facts.weather)) {
            lines.push(`${mood[0]}. Buen momento para tomarte ${restOfPart(facts.part)} con calma.`);
          }
          return lines;
        }
        if (weekend) {
          return [`${weekend}. Disfruta ${restOfPart(facts.part)}.`, ...enjoy];
        }
        return enjoy;
      }
    }
  })();

  return [...new Set(options.map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

export function composeTodayPhrase(facts: PhraseFacts): string {
  const options = phraseOptions(facts);
  return pickVariant(options, phraseSeed(facts));
}
