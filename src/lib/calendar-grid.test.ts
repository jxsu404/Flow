import assert from "node:assert/strict";
import test from "node:test";
import { formatInTimeZone } from "date-fns-tz";
import { eachDateInZone } from "./availability";
import { blockLayout, busyBlocksFromDay, formatMinutesLabel, nowLineTopFromClock, occupancy, weekStats } from "./calendar-grid";
import { addCalendarDays, addCalendarMonths, monthGridRange, weekContaining } from "./datetime";
import type { ScheduleDay } from "./day-plan";
import { subjectTone } from "./subject-color";

const TZ = "America/Costa_Rica";

test("el color de una materia es estable y las tareas no usan esa paleta", () => {
  assert.equal(subjectTone("Matemáticas", "class").key, "teal");
  assert.equal(subjectTone("matemáticas", "class").key, subjectTone("Matemáticas II", "class").key);
  assert.equal(subjectTone("Programación", "class").key, "violet");
  assert.equal(subjectTone("Física", "class").key, "orange");
  assert.equal(subjectTone("Base de datos", "class").key, "emerald");
  assert.equal(subjectTone("Inglés", "class").key, "sky");
  assert.equal(subjectTone("Tarea de conta", "task").key, "task");
  assert.equal(subjectTone("Parcial", "exam").key, "exam");
});

test("weekContaining cae en lunes a domingo", () => {
  const week = weekContaining("2026-08-20", TZ);
  assert.equal(formatInTimeZone(week.start, TZ, "yyyy-MM-dd"), "2026-08-17");
  assert.equal(formatInTimeZone(week.end, TZ, "yyyy-MM-dd"), "2026-08-23");
});

test("monthGridRange cubre 42 días de lunes a domingo", () => {
  const month = monthGridRange("2026-08-23", TZ);
  assert.equal(month.month, "2026-08");
  const dates = eachDateInZone(month.start, month.end, TZ);
  assert.equal(dates.length, 42);
  assert.equal(dates[0], "2026-07-27");
  assert.equal(dates[41], "2026-09-06");
});

function sampleDay(overrides?: Partial<ScheduleDay>): ScheduleDay {
  return {
    date: "2026-08-17",
    weekday: "Lunes",
    heading: "Lunes 17 ago",
    isToday: true,
    isPast: false,
    summary: "",
    parts: [
      {
        part: "Mañana",
        rangeLabel: "08:00 – 12:00",
        startMin: 60,
        durationMin: 240,
        segments: [
          {
            type: "busy",
            title: "Matemáticas",
            kind: "class",
            rangeLabel: "08:00 – 10:00",
            startMin: 60,
            durationMin: 120,
          },
          {
            type: "free",
            title: "Libre",
            rangeLabel: "10:00 – 12:00",
            startMin: 180,
            durationMin: 120,
          },
        ],
      },
    ],
    ...overrides,
  };
}

test("fusiona una clase partida entre mañana y tarde", () => {
  const day = sampleDay({
    parts: [
      {
        part: "Mañana",
        rangeLabel: "11:00 – 12:00",
        startMin: 240,
        durationMin: 60,
        segments: [
          {
            type: "busy",
            title: "Física",
            kind: "class",
            rangeLabel: "11:00 – 12:00",
            startMin: 240,
            durationMin: 60,
          },
        ],
      },
      {
        part: "Tarde",
        rangeLabel: "12:00 – 13:00",
        startMin: 300,
        durationMin: 60,
        segments: [
          {
            type: "busy",
            title: "Física",
            kind: "class",
            rangeLabel: "12:00 – 13:00",
            startMin: 300,
            durationMin: 60,
          },
        ],
      },
    ],
  });
  const blocks = busyBlocksFromDay(day);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.durationMin, 120);
  assert.equal(blocks[0]?.rangeLabel, "11:00 – 13:00");
});

test("un bloque de 2 horas es el doble de alto que uno de 1 hora", () => {
  const two = blockLayout({
    date: "2026-08-17",
    title: "Mate",
    kind: "class",
    rangeLabel: "10:00 – 12:00",
    startMin: 180,
    durationMin: 120,
  });
  const one = blockLayout({
    date: "2026-08-17",
    title: "Tarea",
    kind: "task",
    rangeLabel: "17:00 – 18:00",
    startMin: 600,
    durationMin: 60,
  });
  assert.equal(two.height, one.height * 2);
  assert.equal(two.hidden, false);
});

test("un bloque antes de las 08:00 no entra en la grilla", () => {
  const layout = blockLayout({
    date: "2026-08-17",
    title: "Madrugada",
    kind: "class",
    rangeLabel: "07:00 – 08:00",
    startMin: 0,
    durationMin: 60,
  });
  assert.equal(layout.hidden, true);
});

test("addCalendarDays y addCalendarMonths respetan el huso", () => {
  assert.equal(addCalendarDays("2026-08-23", 7, TZ), "2026-08-30");
  assert.equal(addCalendarMonths("2026-08-15", 1, TZ), "2026-09-15");
});

test("ocupación usa minutos ocupados vs libres reales", () => {
  const stats = occupancy(sampleDay());
  assert.equal(stats.busyMin, 120);
  assert.equal(stats.freeMin, 120);
  assert.equal(stats.pct, 50);
});

test("la línea de ahora cae en la hora de la grilla", () => {
  assert.equal(nowLineTopFromClock(8, 0), 0);
  assert.equal(nowLineTopFromClock(9, 0), 48);
  assert.equal(nowLineTopFromClock(7, 59), null);
  assert.equal(nowLineTopFromClock(22, 0), null);
});

test("weekStats cuenta clases hechas y tiempo libre real", () => {
  const monday = sampleDay();
  const stats = weekStats([monday], "2026-08-17", 180);
  assert.equal(stats.classTotal, 1);
  assert.equal(stats.classDone, 1);
  assert.equal(stats.freeMin, 120);
  assert.equal(formatMinutesLabel(80), "1h 20m");
});
