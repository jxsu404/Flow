import assert from "node:assert/strict";
import test from "node:test";
import { weekFileStem } from "./schedule-export";

test("el nombre de archivo cubre el rango de la semana", () => {
  assert.equal(
    weekFileStem([
      {
        date: "2026-08-17",
        weekday: "Lunes",
        heading: "Lunes 17 ago",
        isToday: false,
        isPast: true,
        summary: "",
        parts: [],
      },
      {
        date: "2026-08-23",
        weekday: "Domingo",
        heading: "Domingo 23 ago",
        isToday: false,
        isPast: false,
        summary: "",
        parts: [],
      },
    ]),
    "horario-flow-2026-08-17_2026-08-23",
  );
});
