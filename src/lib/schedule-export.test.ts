import assert from "node:assert/strict";
import test from "node:test";
import { classTimeBounds, CLASS_SCHEDULE_STEM, groupClassesByDay } from "./schedule-export";

test("agrupa y ordena las clases por día ISO", () => {
  const days = groupClassesByDay([
    { title: "Física", dayOfWeek: 1, startTime: "10:00", endTime: "12:00" },
    { title: "Mate", dayOfWeek: 1, startTime: "08:00", endTime: "10:00", location: "Aula 2" },
    { title: "Historia", dayOfWeek: 3, startTime: "13:00", endTime: "15:00" },
  ]);

  assert.equal(days.length, 7);
  assert.equal(days[0]?.label, "Lunes");
  assert.deepEqual(
    days[0]?.items.map((item) => item.title),
    ["Mate", "Física"],
  );
  assert.equal(days[2]?.items[0]?.title, "Historia");
  assert.equal(days[6]?.items.length, 0);
});

test("el rango horario cubre las clases y un día vacío usa 08:00–16:00", () => {
  assert.deepEqual(classTimeBounds([]), { startMin: 8 * 60, endMin: 16 * 60 });
  assert.deepEqual(
    classTimeBounds([{ title: "Lab", dayOfWeek: 2, startTime: "07:30", endTime: "18:15" }]),
    { startMin: 7 * 60, endMin: 19 * 60 },
  );
});

test("el archivo de exportación usa un nombre estable", () => {
  assert.equal(CLASS_SCHEDULE_STEM, "horario-clases-flow");
});
