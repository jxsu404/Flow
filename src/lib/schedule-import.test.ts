import assert from "node:assert/strict";
import test from "node:test";
import {
  composeClassLocation,
  composeClassTitle,
  countBlocksToCreate,
  daysToCreate,
  emptyDraft,
  isAllowedImportFile,
  matchDuplicates,
  normalizeTime,
  overlappingDrafts,
  rowBlockers,
  toImportItems,
} from "./schedule-import";

test("rechaza formatos y tamaños incompatibles", () => {
  assert.equal(isAllowedImportFile({ name: "horario.png", type: "image/png", size: 100 }).ok, true);
  assert.equal(isAllowedImportFile({ name: "horario.pdf", type: "application/pdf", size: 100 }).ok, true);
  const heic = isAllowedImportFile({ name: "foto.heic", type: "image/heic", size: 100 });
  assert.equal(heic.ok, false);
  const huge = isAllowedImportFile({ name: "horario.jpg", type: "image/jpeg", size: 5 * 1024 * 1024 });
  assert.equal(huge.ok, false);
});

test("normaliza horas 12h y 24h sin inventar", () => {
  assert.equal(normalizeTime("8:00"), "08:00");
  assert.equal(normalizeTime("14:30"), "14:30");
  assert.equal(normalizeTime("10:00 a.m."), "10:00");
  assert.equal(normalizeTime("2:00 pm"), "14:00");
  assert.equal(normalizeTime("12:00 AM"), "00:00");
  assert.equal(normalizeTime("no se ve"), null);
  assert.equal(normalizeTime(null), null);
});

test("compone título y aula sin inventar campos vacíos", () => {
  assert.equal(composeClassTitle({ title: "Contabilidad", courseCode: "CI-1100" }), "CI-1100 Contabilidad");
  assert.equal(composeClassTitle({ title: "CI-1100 Contabilidad", courseCode: "CI-1100" }), "CI-1100 Contabilidad");
  assert.equal(
    composeClassLocation({
      location: "Aula 204",
      section: "01",
      professor: "Juan Pérez",
      extra: "",
    }),
    "Aula 204 · Grupo 01 · Prof. Juan Pérez",
  );
  assert.equal(
    composeClassLocation({ location: "", section: "", professor: "", extra: "" }),
    null,
  );
});

test("una materia de lun y mié se vuelve dos bloques, y keep omite el duplicado", () => {
  const draft = emptyDraft({
    title: "Programación",
    days: [2, 4],
    startTime: "14:00",
    endTime: "16:00",
  });
  const existing = [
    { id: "x", title: "Programación", dayOfWeek: 2, startTime: "14:00", endTime: "16:00" },
  ];
  assert.deepEqual(
    matchDuplicates(draft, existing).map((row) => row.dayOfWeek),
    [2],
  );
  draft.duplicateAction = "keep";
  assert.deepEqual(daysToCreate(draft, existing), [4]);
  draft.duplicateAction = "replace";
  assert.deepEqual(daysToCreate(draft, existing), [2, 4]);
});

test("cuenta solo las clases listas para crear", () => {
  const ready = emptyDraft({
    title: "Mate",
    days: [1, 3],
    startTime: "08:00",
    endTime: "10:00",
  });
  const incomplete = emptyDraft({ title: "Física", days: [2], startTime: "", endTime: "" });
  assert.deepEqual(rowBlockers(incomplete), ["Horario"]);
  assert.equal(countBlocksToCreate([ready, incomplete], []), 2);
  const items = toImportItems([ready, incomplete], []);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0]?.days, [1, 3]);
});

test("detecta solapes entre dos clases del mismo día", () => {
  const a = emptyDraft({
    id: "a",
    title: "A",
    days: [1],
    startTime: "10:00",
    endTime: "12:00",
  });
  const b = emptyDraft({
    id: "b",
    title: "B",
    days: [1, 2],
    startTime: "11:00",
    endTime: "13:00",
  });
  const hits = overlappingDrafts([a, b]);
  assert.deepEqual(hits.get("a"), ["B"]);
  assert.deepEqual(hits.get("b"), ["A"]);
});
