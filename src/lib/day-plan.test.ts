import assert from "node:assert/strict";
import test from "node:test";
import { fromZonedTime } from "date-fns-tz";
import type { Item } from "../db/schema";
import { buildDayPlans, dayInsight, isFlexibleWork } from "./day-plan";

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

test("una entrega de mañana no ocupa el sábado, se sugiere en un bloque libre", () => {
  const saturday = fromZonedTime("2026-08-22T08:00:00", TZ);
  const sundayEvening = fromZonedTime("2026-08-23T16:00:00", TZ);
  const assignment = makeItem({
    id: "ensayo",
    title: "Ensayo de literatura",
    type: "assignment",
    dueAt: sundayEvening,
    priority: "high",
  });

  const days = buildDayPlans({
    from: saturday,
    to: fromZonedTime("2026-08-22T23:59:59", TZ),
    timeZone: TZ,
    classBlocks: [],
    items: [assignment],
    calendarBusy: [],
  });

  assert.equal(days.length, 1);
  const day = days[0];
  assert.ok(day);
  assert.equal(day.weekday, "Sábado");
  assert.equal(day.segments.every((s) => s.type === "free"), true);
  assert.equal(day.status, "free");
  assert.match(day.summary, /bastante libre/);
  assert.match(day.summary, /Ensayo de literatura/);
  const morning = day.segments.find((s) => s.type === "free" && s.partLabel === "Mañana");
  assert.ok(morning && morning.type === "free");
  assert.equal(morning.suggestion?.title, "Ensayo de literatura");
  assert.equal(morning.suggestion?.dueLabel, "mañana");
});

test("las clases aparecen como ocupadas y parten los bloques libres", () => {
  const monday = fromZonedTime("2026-08-17T07:00:00", TZ);
  const days = buildDayPlans({
    from: monday,
    to: fromZonedTime("2026-08-17T23:59:59", TZ),
    timeZone: TZ,
    classBlocks: [{ title: "Matemáticas", dayOfWeek: 1, startTime: "08:00", endTime: "10:00" }],
    items: [],
    calendarBusy: [],
  });
  const day = days[0];
  assert.ok(day);
  const math = day.segments.find((s) => s.type === "busy" && s.title === "Matemáticas");
  assert.ok(math && math.type === "busy");
  assert.equal(math.rangeLabel, "08:00 – 10:00");
  const before = day.segments.find(
    (s) => s.type === "free" && s.rangeLabel === "07:00 – 08:00",
  );
  const after = day.segments.find(
    (s) => s.type === "free" && s.rangeLabel === "10:00 – 12:00",
  );
  assert.ok(before);
  assert.ok(after);
});

test("si la mañana tiene clase y la tarde está libre, lo dice", () => {
  const monday = fromZonedTime("2026-08-17T07:00:00", TZ);
  const days = buildDayPlans({
    from: monday,
    to: fromZonedTime("2026-08-17T23:59:59", TZ),
    timeZone: TZ,
    classBlocks: [{ title: "Matemáticas", dayOfWeek: 1, startTime: "08:00", endTime: "10:00" }],
    items: [],
    calendarBusy: [],
  });
  const day = days[0];
  assert.ok(day);
  assert.equal(dayInsight(day), "Tienes tiempo disponible esta tarde.");
});

test("isFlexibleWork: entregas sin hora sí, eventos con horario no", () => {
  assert.equal(
    isFlexibleWork(
      makeItem({ id: "a", title: "Tarea", type: "assignment", dueAt: new Date() }),
    ),
    true,
  );
  assert.equal(
    isFlexibleWork(
      makeItem({
        id: "b",
        title: "Reunión",
        type: "event",
        startAt: new Date(),
        endAt: new Date(),
      }),
    ),
    false,
  );
});

test("una entrega hoy a las 23:59 no deja el domingo bastante libre", () => {
  const sunday = fromZonedTime("2026-08-23T16:00:00", TZ);
  const due = fromZonedTime("2026-08-23T23:59:00", TZ);
  const days = buildDayPlans({
    from: fromZonedTime("2026-08-23T00:00:00", TZ),
    to: fromZonedTime("2026-08-23T23:59:59", TZ),
    now: sunday,
    timeZone: TZ,
    classBlocks: [],
    items: [makeItem({ id: "conta", title: "Tarea de conta", type: "assignment", dueAt: due })],
    calendarBusy: [],
  });
  const day = days[0];
  assert.ok(day);
  assert.equal(day.status, "freeWithDue");
  assert.match(day.summary, /libre de clases/);
  assert.match(day.summary, /1 entrega pendiente/);
  assert.equal(/bastante libre/.test(day.summary), false);
  assert.equal(day.obligations.length, 1);
  assert.equal(day.obligations[0]?.afterHours, true);
  assert.equal(day.obligations[0]?.timeLabel, "23:59");
});
