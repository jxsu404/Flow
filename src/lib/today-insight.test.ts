import assert from "node:assert/strict";
import test from "node:test";
import { fromZonedTime } from "date-fns-tz";
import type { Item } from "../db/schema";
import { INSIGHT_STATUS, interpretToday, resolveDayPart } from "./today-insight";
import { composeTodayPhrase, greetingFor, phraseOptions, type PhraseFacts } from "./today-phrase";

const TZ = "America/Costa_Rica";

function makeItem(partial: Partial<Item> & Pick<Item, "id" | "title" | "type">): Item {
  return {
    userId: "u1",
    notes: null,
    dueAt: null,
    startAt: null,
    endAt: null,
    durationMinutes: null,
    priority: "medium",
    status: "pending",
    calendarEventId: null,
    source: "voice",
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    ...partial,
  };
}

function at(isoLocal: string): Date {
  return fromZonedTime(isoLocal, TZ);
}

function text(insight: { headline: string; detail: string }): string {
  return `${insight.headline} ${insight.detail}`.trim();
}

const CONTA = makeItem({
  id: "conta",
  title: "Tarea de conta",
  type: "assignment",
  dueAt: at("2026-08-23T23:59:00"),
});

const MATH = {
  title: "Matemáticas",
  kind: "class",
  start: at("2026-08-23T08:00:00"),
  end: at("2026-08-23T10:00:00"),
};

function dueFacts(overrides: Partial<PhraseFacts> = {}): PhraseFacts {
  return {
    situation: "due_today",
    part: { id: "afternoon", label: "Tarde", rangeLabel: "12:00 – 18:00", phase: "active" },
    weekday: "Domingo",
    hour: 16,
    today: "2026-08-23",
    title: "Tarea de conta",
    kind: "entrega",
    timeLabel: "23:59",
    minutesLeft: 479,
    quietPart: true,
    partBusyTitles: [],
    remainingClassTitles: [],
    hasLaterWork: false,
    doneTodayCount: 0,
    pendingCount: 1,
    weather: null,
    ...overrides,
  };
}

test("el periodo: 10:30 es mañana, 12:00 tarde, 18:00 noche", () => {
  assert.equal(resolveDayPart(at("2026-08-23T10:30:00"), TZ).label, "Mañana");
  assert.equal(resolveDayPart(at("2026-08-23T12:00:00"), TZ).label, "Tarde");
  assert.equal(resolveDayPart(at("2026-08-23T15:00:00"), TZ).label, "Tarde");
  assert.equal(resolveDayPart(at("2026-08-23T18:00:00"), TZ).label, "Noche");
});

test("antes de las 07:00 y después de las 22:00 usan noche", () => {
  const dawn = resolveDayPart(at("2026-08-23T06:30:00"), TZ);
  assert.equal(dawn.label, "Noche");
  assert.equal(dawn.phase, "early");
  const late = resolveDayPart(at("2026-08-23T22:30:00"), TZ);
  assert.equal(late.label, "Noche");
  assert.equal(late.phase, "windingDown");
});

test("caso 1: mañana libre interpreta el momento, sin inventar tareas", () => {
  const insight = interpretToday({ now: at("2026-08-23T10:30:00"), timeZone: TZ, items: [], busy: [] });
  assert.equal(insight.situation, "free");
  assert.equal(insight.part.label, "Mañana");
  assert.match(text(insight), /mañana/i);
  assert.equal(/conta|estudiar|lluvi/i.test(text(insight)), false);
});

test("caso 2: mañana tranquila con entrega sugiere avanzar en esa tarea", () => {
  const insight = interpretToday({
    now: at("2026-08-23T09:00:00"),
    timeZone: TZ,
    items: [CONTA],
    busy: [],
  });
  assert.equal(insight.situation, "due_today");
  assert.match(text(insight), /conta/i);
  assert.equal(/lluvi/i.test(text(insight)), false);
  assert.equal(/no tienes pendientes/i.test(text(insight)), false);
});

test("caso 3: una tarea completada no cuenta como obligación", () => {
  const insight = interpretToday({
    now: at("2026-08-23T09:00:00"),
    timeZone: TZ,
    items: [{ ...CONTA, status: "done" }],
    busy: [],
  });
  assert.equal(insight.situation, "free");
  assert.match(text(insight), /listo|tranquila|disfruta|ya está|calma/i);
  assert.equal(/vence|pendiente para hoy/i.test(text(insight)), false);
});

test("caso 4: en la noche, un deadline cercano pide no dejarlo para después", () => {
  const insight = interpretToday({
    now: at("2026-08-23T21:30:00"),
    timeZone: TZ,
    items: [CONTA],
    busy: [],
  });
  assert.equal(insight.situation, "soon");
  assert.equal(insight.part.label, "Noche");
  assert.match(text(insight), /conta/i);
  assert.match(text(insight), /noche|después|avanza/i);
  assert.equal(/urgente|🔥/i.test(text(insight)), false);
});

test("caso 5: deadline inminente pide cerrarla ahora", () => {
  const insight = interpretToday({
    now: at("2026-08-23T23:30:00"),
    timeZone: TZ,
    items: [CONTA],
    busy: [],
  });
  assert.equal(insight.situation, "imminent");
  assert.equal(insight.part.phase, "windingDown");
  assert.match(text(insight), /ahora|minutos/i);
  assert.match(text(insight), /conta/i);
});

test("caso 6: deadline ya pasado es una entrega vencida", () => {
  const insight = interpretToday({
    now: at("2026-08-23T15:00:00"),
    timeZone: TZ,
    items: [
      makeItem({
        id: "conta-am",
        title: "Tarea de conta",
        type: "assignment",
        dueAt: at("2026-08-23T10:00:00"),
      }),
    ],
    busy: [],
  });
  assert.equal(insight.situation, "overdue");
  assert.match(text(insight), /venc/i);
  assert.match(text(insight), /conta/i);
});

test("caso 7: una clase en la mañana no inventa entregas", () => {
  const insight = interpretToday({
    now: at("2026-08-23T07:00:00"),
    timeZone: TZ,
    items: [],
    busy: [MATH],
  });
  assert.equal(insight.situation, "busy");
  assert.match(text(insight), /matemáticas/i);
  assert.equal(/entrega|conta|estudiar/i.test(text(insight)), false);
});

test("caso 8: por la tarde, la entrega pendiente es lo que conviene hacer", () => {
  const insight = interpretToday({
    now: at("2026-08-23T16:00:00"),
    timeZone: TZ,
    items: [CONTA],
    busy: [MATH],
  });
  assert.equal(insight.situation, "due_today");
  assert.equal(insight.part.label, "Tarde");
  assert.match(text(insight), /conta/i);
  assert.match(text(insight), /tarde|tiempo|avanzar|adelantar/i);
});

test("sin datos de clima, ninguna frase habla de lluvia", () => {
  const options = phraseOptions(dueFacts({ weather: null }));
  assert.equal(options.some((line) => /lluvi/i.test(line)), false);
  const withRain = phraseOptions(dueFacts({ weather: { condition: "rain" } }));
  assert.equal(withRain.some((line) => /lluvi/i.test(line)), true);
  assert.equal(withRain.every((line) => /conta/i.test(line)), true);
});

test("las variantes del mismo contexto conservan el significado", () => {
  const options = phraseOptions(dueFacts());
  assert.ok(options.length >= 2);
  for (const line of options) {
    assert.match(line, /conta/i);
    assert.equal(/🔥|tú puedes|romperla/i.test(line), false);
  }
  const a = composeTodayPhrase(dueFacts({ hour: 15 }));
  const b = composeTodayPhrase(dueFacts({ hour: 16 }));
  assert.match(a, /conta/i);
  assert.match(b, /conta/i);
});

test("el horario habitual no oculta una entrega a las 23:59", () => {
  const insight = interpretToday({
    now: at("2026-08-23T22:30:00"),
    timeZone: TZ,
    items: [CONTA],
    busy: [],
  });
  assert.notEqual(insight.situation, "free");
  assert.match(text(insight), /conta/i);
});

test("si hay entrega vencida y otra para más tarde, gana la vencida", () => {
  const insight = interpretToday({
    now: at("2026-08-23T15:00:00"),
    timeZone: TZ,
    items: [
      makeItem({
        id: "late",
        title: "Ensayo",
        type: "assignment",
        dueAt: at("2026-08-23T23:59:00"),
      }),
      makeItem({
        id: "missed",
        title: "Quiz de física",
        type: "assignment",
        dueAt: at("2026-08-23T10:00:00"),
      }),
    ],
    busy: [],
  });
  assert.equal(insight.situation, "overdue");
  assert.match(text(insight), /física/i);
});

test("una entrega cercana gana a un examen más tarde", () => {
  const insight = interpretToday({
    now: at("2026-08-23T16:00:00"),
    timeZone: TZ,
    items: [
      makeItem({
        id: "exam",
        title: "Examen de cálculo",
        type: "exam",
        dueAt: at("2026-08-23T20:00:00"),
      }),
      makeItem({
        id: "conta-soon",
        title: "Tarea de conta",
        type: "assignment",
        dueAt: at("2026-08-23T18:00:00"),
      }),
    ],
    busy: [],
  });
  assert.equal(insight.situation, "soon");
  assert.match(text(insight), /conta/i);
  assert.equal(/cálculo/i.test(text(insight)), false);
});

test("sin obligaciones no sugiere estudiar", () => {
  const insight = interpretToday({
    now: at("2026-08-23T16:00:00"),
    timeZone: TZ,
    items: [],
    busy: [],
  });
  assert.equal(insight.situation, "free");
  assert.match(text(insight), /tarde/i);
  assert.equal(/estudiar|conta|lluvi/i.test(text(insight)), false);
});

test("un examen no se describe como entrega", () => {
  const options = phraseOptions(
    dueFacts({
      situation: "soon",
      title: "Examen de cálculo",
      kind: "examen",
      timeLabel: "20:00",
      minutesLeft: 90,
    }),
  );
  assert.equal(options.some((line) => /entrega/i.test(line)), false);
  assert.equal(options.every((line) => /cálculo/i.test(line)), true);
});

test("la tarde lluviosa enriquece la tarea, no la sustituye", () => {
  const options = phraseOptions(dueFacts({ weather: { condition: "rain" } }));
  assert.ok(options.some((line) => /lluvi/i.test(line) && /conta/i.test(line) && /noche/i.test(line)));
});

test("la conclusión corta acompaña a la frase", () => {
  const pending = interpretToday({
    now: at("2026-08-23T16:00:00"),
    timeZone: TZ,
    items: [CONTA],
    busy: [],
  });
  assert.equal(pending.statusLabel, INSIGHT_STATUS.due_today);
  assert.match(pending.statusLabel, /entrega pendiente/i);

  const calm = interpretToday({ now: at("2026-08-23T16:00:00"), timeZone: TZ, items: [], busy: [] });
  assert.match(calm.statusLabel, /libre/i);
});

test("el clima real enriquece la frase según el periodo", () => {
  const rainy = interpretToday({
    now: at("2026-08-23T16:00:00"),
    timeZone: TZ,
    items: [CONTA],
    busy: [],
    weather: { condition: "rain" },
  });
  assert.match(text(rainy), /conta/i);
  assert.match(text(rainy), /lluvi/i);

  const sunny = interpretToday({
    now: at("2026-08-23T09:00:00"),
    timeZone: TZ,
    items: [],
    busy: [],
    weather: { condition: "clear" },
  });
  assert.match(text(sunny), /soleada|despejada/i);
  assert.equal(/lluvi/i.test(text(sunny)), false);
});

test("una obligación urgente no queda tapada por el clima", () => {
  const insight = interpretToday({
    now: at("2026-08-23T21:30:00"),
    timeZone: TZ,
    items: [CONTA],
    busy: [],
    weather: { condition: "clear", temperatureC: 21 },
  });
  assert.equal(insight.situation, "soon");
  assert.match(text(insight), /conta/i);
});

test("el saludo sigue al periodo del día", () => {
  assert.equal(greetingFor(resolveDayPart(at("2026-08-23T09:00:00"), TZ)), "Buenos días");
  assert.equal(greetingFor(resolveDayPart(at("2026-08-23T16:00:00"), TZ)), "Buenas tardes");
  assert.equal(greetingFor(resolveDayPart(at("2026-08-23T20:00:00"), TZ)), "Buenas noches");
});

test("las horas distintas cambian la variante sin cambiar el sentido", () => {
  const seen = new Set(
    [14, 15, 16, 17].map((hour) => composeTodayPhrase(dueFacts({ hour }))),
  );
  assert.ok(seen.size >= 2);
  for (const line of seen) {
    assert.match(line, /conta/i);
  }
});
