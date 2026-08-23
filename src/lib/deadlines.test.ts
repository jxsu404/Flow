import assert from "node:assert/strict";
import test from "node:test";
import { fromZonedTime } from "date-fns-tz";
import { activityKind, dueCaption, urgencyForDue } from "./deadlines";

const TZ = "America/Costa_Rica";
const TODAY = "2026-08-22";

test("urgencia: mañana es rojo, 3 días naranja, 7 días verde", () => {
  const tomorrow = urgencyForDue(fromZonedTime("2026-08-23T16:00:00", TZ), TODAY, TZ);
  assert.equal(tomorrow?.level, "urgent");
  assert.equal(tomorrow?.label, "MAÑANA");

  const three = urgencyForDue(fromZonedTime("2026-08-25T08:00:00", TZ), TODAY, TZ);
  assert.equal(three?.level, "soon");
  assert.equal(three?.label, "3 DÍAS");

  const week = urgencyForDue(fromZonedTime("2026-08-29T08:00:00", TZ), TODAY, TZ);
  assert.equal(week?.level, "later");
  assert.equal(week?.label, "7 DÍAS");
});

test("tipo: examen, proyecto y tarea salen de los datos", () => {
  assert.equal(activityKind({ type: "exam", title: "Parcial 1" }), "examen");
  assert.equal(activityKind({ type: "assignment", title: "Proyecto de programación" }), "proyecto");
  assert.equal(activityKind({ type: "task", title: "Tarea de conta" }), "tarea");
  assert.equal(activityKind({ type: "assignment", title: "Trabajo de literatura" }), "trabajo");
  assert.equal(activityKind({ type: "assignment", title: "Ensayo" }), "entrega");
});

test("el pie de deadline prioriza el vencimiento, sin dos puntos de más", () => {
  const todayDue = fromZonedTime("2026-08-22T23:59:00", TZ);
  const urgency = urgencyForDue(todayDue, TODAY, TZ);
  assert.equal(dueCaption({ type: "assignment", dueAt: todayDue }, urgency), "Entrega hoy");
  const exam = fromZonedTime("2026-08-23T08:00:00", TZ);
  const examUrgency = urgencyForDue(exam, TODAY, TZ);
  assert.equal(dueCaption({ type: "exam", dueAt: exam }, examUrgency), "Examen mañana");
});
