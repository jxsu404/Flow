import assert from "node:assert/strict";
import test from "node:test";
import { fromZonedTime } from "date-fns-tz";
import type { Item } from "@/db/schema";
import {
  composeTodayAtmosphere,
  duePhrase,
  namedItem,
  pickFocalItem,
} from "./today-atmosphere";
import { weatherMoodFromCode } from "./weather";

const TZ = "America/Costa_Rica";

function item(partial: Partial<Item> & Pick<Item, "title" | "type">): Item {
  return {
    id: partial.id ?? "item-1",
    userId: "user-1",
    notes: null,
    dueAt: null,
    startAt: null,
    endAt: null,
    durationMinutes: null,
    priority: "medium",
    status: "pending",
    calendarEventId: null,
    source: "text",
    createdAt: new Date("2026-08-23T12:00:00Z"),
    updatedAt: new Date("2026-08-23T12:00:00Z"),
    ...partial,
  };
}

test("el código WMO de chubascos se lee como lluvia", () => {
  assert.equal(weatherMoodFromCode(80, 0, 0), "rain");
  assert.equal(weatherMoodFromCode(0, 0, 0), "clear");
  assert.equal(weatherMoodFromCode(95, 0, 0), "storm");
});

test("nombra la entrega sin duplicar el tipo", () => {
  assert.equal(namedItem({ type: "assignment", title: "Contabilidad" }), "entrega de Contabilidad");
  assert.equal(namedItem({ type: "assignment", title: "entrega de Contabilidad" }), "entrega de Contabilidad");
});

test("una mañana soleada sin tareas invita a empezar con calma", () => {
  const result = composeTodayAtmosphere({
    dayPart: "morning",
    weather: { mood: "clear", isDay: true },
    focal: null,
    urgent: false,
    duePhrase: null,
    nextClass: null,
  });
  assert.equal(result.emoji, "☀️");
  assert.match(result.line, /mañana soleada/i);
  assert.match(result.line, /calma/i);
});

test("una tarde lluviosa menciona la tarea, no un pronóstico", () => {
  const result = composeTodayAtmosphere({
    dayPart: "afternoon",
    weather: { mood: "rain", isDay: true },
    focal: { type: "task", title: "Contabilidad" },
    urgent: false,
    duePhrase: null,
    nextClass: null,
  });
  assert.equal(result.emoji, "🌧️");
  assert.match(result.line, /tarde lluviosa/i);
  assert.match(result.line, /Contabilidad/);
});

test("la entrega urgente manda sobre el clima", () => {
  const result = composeTodayAtmosphere({
    dayPart: "afternoon",
    weather: { mood: "rain", isDay: true },
    focal: { type: "assignment", title: "Contabilidad" },
    urgent: true,
    duePhrase: "esta noche",
    nextClass: null,
  });
  assert.match(result.line, /^Tu entrega de Contabilidad vence esta noche\./);
  assert.match(result.line, /lluviosa/);
  assert.ok(!result.line.startsWith("Una tarde lluviosa"));
});

test("sin clima no inventa lluvia ni sol", () => {
  const result = composeTodayAtmosphere({
    dayPart: "afternoon",
    weather: null,
    focal: { type: "task", title: "Contabilidad" },
    urgent: false,
    duePhrase: null,
    nextClass: null,
  });
  assert.equal(result.emoji, null);
  assert.match(result.line, /tarde tranquila/);
  assert.doesNotMatch(result.line, /lluvi|solead|nublad/i);
});

test("noche despejada usa la luna, no el sol", () => {
  const result = composeTodayAtmosphere({
    dayPart: "night",
    weather: { mood: "clear", isDay: false },
    focal: null,
    urgent: false,
    duePhrase: null,
    nextClass: null,
  });
  assert.equal(result.emoji, "🌙");
  assert.match(result.line, /noche/);
});

test("prioriza el examen de hoy sobre una tarea genérica", () => {
  const now = fromZonedTime("2026-08-23T15:00:00", TZ);
  const exam = item({
    id: "exam-1",
    type: "exam",
    title: "Cálculo",
    dueAt: fromZonedTime("2026-08-23T18:00:00", TZ),
  });
  const task = item({
    id: "task-1",
    type: "task",
    title: "Leer capítulo",
    dueAt: fromZonedTime("2026-08-23T21:00:00", TZ),
  });
  const focal = pickFocalItem([task, exam], [], now, TZ);
  assert.equal(focal?.id, "exam-1");
});

test("una entrega a las 20 se describe como esta noche", () => {
  const now = fromZonedTime("2026-08-23T15:00:00", TZ);
  const due = fromZonedTime("2026-08-23T20:00:00", TZ);
  assert.equal(duePhrase(due, now, TZ), "esta noche");
});
