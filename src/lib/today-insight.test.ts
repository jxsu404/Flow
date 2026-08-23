import assert from "node:assert/strict";
import test from "node:test";
import { fromZonedTime } from "date-fns-tz";
import type { Item } from "../db/schema";
import { interpretToday } from "./today-insight";

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

test("caso 1: día completamente libre", () => {
  const insight = interpretToday({ now: at("2026-08-23T09:00:00"), timeZone: TZ, items: [], busy: [] });
  assert.equal(insight.situation, "free");
  assert.equal(insight.tone, "calm");
  assert.equal(insight.headline, "Tu día está libre");
  assert.match(insight.detail, /tareas, clases ni eventos/i);
  assert.equal(insight.subject, null);
});

test("caso 2: sin clases y con tarea pendiente a las 23:59 no es un día libre", () => {
  const insight = interpretToday({
    now: at("2026-08-23T09:00:00"),
    timeZone: TZ,
    items: [CONTA],
    busy: [],
  });
  assert.equal(insight.situation, "due_today");
  assert.equal(insight.tone, "watch");
  assert.match(insight.headline, /entrega pendiente/i);
  assert.match(insight.detail, /aún tienes tiempo/i);
  assert.equal(/libre/.test(`${insight.headline} ${insight.detail}`), false);
  assert.equal(insight.subject?.title, "Tarea de conta");
  assert.match(insight.subject?.meta ?? "", /23:59/);
});

test("caso 3: una tarea completada no cuenta como obligación", () => {
  const insight = interpretToday({
    now: at("2026-08-23T09:00:00"),
    timeZone: TZ,
    items: [{ ...CONTA, status: "done" }],
    busy: [],
  });
  assert.equal(insight.situation, "free");
  assert.equal(insight.headline, "Tu día está libre");
});

test("caso 4: deadline cercano pide no dejarlo para después", () => {
  const insight = interpretToday({
    now: at("2026-08-23T21:30:00"),
    timeZone: TZ,
    items: [CONTA],
    busy: [],
  });
  assert.equal(insight.situation, "soon");
  assert.equal(insight.tone, "watch");
  assert.match(insight.headline, /no lo dejes para después/i);
  assert.equal(/urgente/i.test(insight.headline), false);
});

test("caso 5: deadline muy cercano pide terminarla ahora", () => {
  const insight = interpretToday({
    now: at("2026-08-23T23:30:00"),
    timeZone: TZ,
    items: [CONTA],
    busy: [],
  });
  assert.equal(insight.situation, "imminent");
  assert.equal(insight.tone, "act");
  assert.match(insight.headline, /ahora/i);
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
  assert.equal(insight.tone, "act");
  assert.match(insight.headline, /entrega vencida/i);
  assert.match(insight.detail, /todavía está pendiente/i);
});

test("caso 7: clases sin deadlines describen un día ocupado, sin inventar problemas", () => {
  const insight = interpretToday({
    now: at("2026-08-23T07:00:00"),
    timeZone: TZ,
    items: [],
    busy: [MATH],
  });
  assert.equal(insight.situation, "busy");
  assert.equal(insight.tone, "occupied");
  assert.match(insight.headline, /ocupado/i);
  assert.equal(/entrega|vencid|urgente/i.test(`${insight.headline} ${insight.detail}`), false);
});

test("caso 8: clases y deadline priorizan la obligación", () => {
  const insight = interpretToday({
    now: at("2026-08-23T16:00:00"),
    timeZone: TZ,
    items: [CONTA],
    busy: [MATH],
  });
  assert.equal(insight.situation, "due_today");
  assert.match(insight.headline, /entrega pendiente/i);
  assert.match(insight.detail, /clases/i);
  assert.match(insight.detail, /23:59/);
});

test("el horario habitual no oculta una entrega a las 23:59", () => {
  const insight = interpretToday({
    now: at("2026-08-23T22:30:00"),
    timeZone: TZ,
    items: [CONTA],
    busy: [],
  });
  assert.notEqual(insight.situation, "free");
  assert.match(insight.headline + insight.detail, /conta|entrega|después|ahora/i);
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
