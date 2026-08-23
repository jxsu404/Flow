import assert from "node:assert/strict";
import test from "node:test";
import { fromZonedTime } from "date-fns-tz";
import type { Item } from "../db/schema";
import { interpretToday, resolveDayPart } from "./today-insight";

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

test("caso 1: mañana libre habla de la mañana, no del día entero", () => {
  const insight = interpretToday({ now: at("2026-08-23T10:30:00"), timeZone: TZ, items: [], busy: [] });
  assert.equal(insight.situation, "free");
  assert.equal(insight.part.label, "Mañana");
  assert.equal(insight.part.rangeLabel, "07:00 – 12:00");
  assert.match(insight.headline, /buenos días/i);
  assert.match(insight.detail, /mañana está bastante tranquila/i);
  assert.equal(/tarde|noche/i.test(`${insight.headline} ${insight.detail}`), false);
});

test("caso 2: mañana sin clases y con entrega pendiente no es un día libre", () => {
  const insight = interpretToday({
    now: at("2026-08-23T09:00:00"),
    timeZone: TZ,
    items: [CONTA],
    busy: [],
  });
  assert.equal(insight.situation, "due_today");
  assert.equal(insight.part.label, "Mañana");
  assert.match(`${insight.headline} ${insight.detail}`, /conta|entrega pendiente/i);
  assert.equal(/libre/.test(`${insight.headline} ${insight.detail}`), false);
  assert.equal(insight.subject?.title, "Tarea de conta");
});

test("caso 3: una tarea completada no cuenta como obligación", () => {
  const insight = interpretToday({
    now: at("2026-08-23T09:00:00"),
    timeZone: TZ,
    items: [{ ...CONTA, status: "done" }],
    busy: [],
  });
  assert.equal(insight.situation, "free");
  assert.match(insight.detail, /mañana está bastante tranquila/i);
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
  assert.match(insight.headline, /no lo dejes para después/i);
  assert.match(insight.detail, /noche/i);
  assert.equal(/urgente/i.test(insight.headline), false);
});

test("caso 5: después de las 22:00 el día está terminando y el deadline es ahora", () => {
  const insight = interpretToday({
    now: at("2026-08-23T23:30:00"),
    timeZone: TZ,
    items: [CONTA],
    busy: [],
  });
  assert.equal(insight.situation, "imminent");
  assert.equal(insight.part.label, "Noche");
  assert.equal(insight.part.phase, "windingDown");
  assert.match(insight.headline, /ahora/i);
  assert.match(insight.detail, /terminando/i);
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
  assert.equal(insight.part.label, "Tarde");
  assert.match(insight.headline, /entrega vencida/i);
});

test("caso 7: una clase en la mañana no inventa entregas y no habla de tarde o noche", () => {
  const insight = interpretToday({
    now: at("2026-08-23T07:00:00"),
    timeZone: TZ,
    items: [],
    busy: [MATH],
  });
  assert.equal(insight.situation, "busy");
  assert.equal(insight.part.label, "Mañana");
  assert.match(insight.headline, /mañana/i);
  assert.match(insight.headline, /matemáticas/i);
  assert.equal(/entrega|vencid|tarde|noche/i.test(`${insight.headline} ${insight.detail}`), false);
});

test("caso 8: por la tarde, una entrega gana sobre una clase que ya fue", () => {
  const insight = interpretToday({
    now: at("2026-08-23T16:00:00"),
    timeZone: TZ,
    items: [CONTA],
    busy: [MATH],
  });
  assert.equal(insight.situation, "due_today");
  assert.equal(insight.part.label, "Tarde");
  assert.match(insight.headline, /tarde está tranquila/i);
  assert.match(insight.detail, /conta/i);
});

test("el horario habitual no oculta una entrega a las 23:59", () => {
  const insight = interpretToday({
    now: at("2026-08-23T22:30:00"),
    timeZone: TZ,
    items: [CONTA],
    busy: [],
  });
  assert.notEqual(insight.situation, "free");
  assert.equal(insight.part.label, "Noche");
  assert.match(`${insight.headline} ${insight.detail}`, /conta|pendiente|terminando/i);
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
  assert.equal(insight.subject?.title, "Quiz de física");
});
