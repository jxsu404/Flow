import assert from "node:assert/strict";
import test from "node:test";
import { fromZonedTime } from "date-fns-tz";
import {
  expandClassBlocks,
  findFreeSlots,
  mergeIntervals,
  subtractBusy,
} from "./availability";

const TZ = "America/Costa_Rica";

test("expande clases semanales al día ISO correcto", () => {
  const monday = fromZonedTime("2026-08-17T00:00:00", TZ);
  const tuesday = fromZonedTime("2026-08-18T23:59:59", TZ);
  const intervals = expandClassBlocks(
    [
      {
        title: "Matemáticas",
        dayOfWeek: 1,
        startTime: "08:00",
        endTime: "10:00",
      },
    ],
    monday,
    tuesday,
    TZ,
  );
  assert.equal(intervals.length, 1);
  assert.equal(intervals[0]?.title, "Matemáticas");
  assert.equal(intervals[0]?.start.toISOString(), fromZonedTime("2026-08-17T08:00:00", TZ).toISOString());
  assert.equal(intervals[0]?.end.toISOString(), fromZonedTime("2026-08-17T10:00:00", TZ).toISOString());
});

test("encuentra hueco de 2 horas entre clase y evento", () => {
  const dayStart = fromZonedTime("2026-08-17T00:00:00", TZ);
  const dayEnd = fromZonedTime("2026-08-17T23:59:59", TZ);
  const slots = findFreeSlots({
    from: dayStart,
    to: dayEnd,
    timeZone: TZ,
    classBlocks: [
      { title: "Matemáticas", dayOfWeek: 1, startTime: "08:00", endTime: "10:00" },
    ],
    items: [],
    calendarBusy: [
      {
        start: fromZonedTime("2026-08-17T12:00:00", TZ),
        end: fromZonedTime("2026-08-17T14:00:00", TZ),
        title: "Almuerzo",
      },
    ],
  });
  const twoHours = slots.find((s) => s.minutes === 120 && s.start.getTime() === fromZonedTime("2026-08-17T10:00:00", TZ).getTime());
  assert.ok(twoHours, "debería haber 2 horas libres entre 10:00 y 12:00");
});

test("fusiona intervalos solapados", () => {
  const merged = mergeIntervals([
    { start: new Date("2026-08-17T14:00:00.000Z"), end: new Date("2026-08-17T16:00:00.000Z") },
    { start: new Date("2026-08-17T15:00:00.000Z"), end: new Date("2026-08-17T17:00:00.000Z") },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.end.toISOString(), "2026-08-17T17:00:00.000Z");
});

test("ignora huecos menores a 30 minutos", () => {
  const free = subtractBusy(
    [{ start: new Date("2026-08-17T13:00:00.000Z"), end: new Date("2026-08-17T16:00:00.000Z") }],
    [
      { start: new Date("2026-08-17T13:00:00.000Z"), end: new Date("2026-08-17T15:50:00.000Z") },
    ],
  );
  assert.equal(free.length, 0);
});
