import assert from "node:assert/strict";
import test from "node:test";
import { fromZonedTime } from "date-fns-tz";
import type { Item } from "../db/schema";
import { classifyDay, obligationPhrase, obligationsOnDate } from "./day-status";

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

test("una entrega a las 23:59 cuenta como obligación de hoy y queda fuera del horario habitual", () => {
  const due = fromZonedTime("2026-08-23T23:59:00", TZ);
  const items = [
    makeItem({ id: "conta", title: "Tarea de conta", type: "assignment", dueAt: due }),
  ];
  const list = obligationsOnDate(items, [], "2026-08-23", TZ);
  assert.equal(list.length, 1);
  assert.equal(list[0]?.timeLabel, "23:59");
  assert.equal(list[0]?.afterHours, true);
  assert.equal(list[0]?.due, true);
  assert.equal(obligationPhrase(list), "1 entrega pendiente");
});

test("una entrega de mañana no es obligación del sábado", () => {
  const items = [
    makeItem({
      id: "ensayo",
      title: "Ensayo",
      type: "assignment",
      dueAt: fromZonedTime("2026-08-23T23:59:00", TZ),
    }),
  ];
  assert.equal(obligationsOnDate(items, [], "2026-08-22", TZ).length, 0);
});

test("sin clases y con entrega hoy no es un día bastante libre", () => {
  const classified = classifyDay({
    busy: [],
    free: [],
    obligations: [
      {
        id: "conta",
        title: "Tarea de conta",
        type: "assignment",
        timeLabel: "23:59",
        afterHours: true,
        due: true,
      },
    ],
    isToday: true,
  });
  assert.equal(classified.status, "freeWithDue");
  assert.match(classified.summary, /libre de clases/);
  assert.match(classified.summary, /1 entrega pendiente/);
  assert.equal(/bastante libre/.test(classified.summary), false);
});

test("sin clases ni obligaciones sí está bastante libre", () => {
  const classified = classifyDay({
    busy: [],
    free: [],
    obligations: [],
    isToday: true,
  });
  assert.equal(classified.status, "free");
  assert.equal(classified.summary, "Tu día está bastante libre.");
});
