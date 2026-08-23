import { generateText, Output } from "ai";
import { z } from "zod";
import { geminiFlash } from "@/lib/ai/flow-agent";
import { parseDayOfWeek } from "@/lib/datetime";
import {
  emptyDraft,
  normalizeTime,
  type ParseDocumentResult,
  type ScheduleDraft,
} from "@/lib/schedule-import";

const uncertainFieldSchema = z.enum([
  "title",
  "days",
  "startTime",
  "endTime",
  "professor",
  "location",
  "section",
  "courseCode",
]);

const extractedClassSchema = z.object({
  title: z.string().nullable().optional(),
  days: z.array(z.union([z.number(), z.string()])).optional().default([]),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  professor: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  section: z.string().nullable().optional(),
  courseCode: z.string().nullable().optional(),
  extra: z.string().nullable().optional(),
  uncertainFields: z.array(uncertainFieldSchema).optional().default([]),
  issue: z.string().nullable().optional(),
});

const parseOutputSchema = z.object({
  documentWarning: z.string().nullable().optional(),
  classes: z.array(extractedClassSchema).default([]),
});

const PARSE_PROMPT = `Eres Flow. Extrae el HORARIO DE CLASES de este documento (imagen o PDF).

Devuelve solo clases académicas reales (materias). Ignora encabezados, leyendas, almuerzos, recreos y texto decorativo.

Reglas de precisión (obligatorias):
- No inventes datos. Si no se lee con claridad, usa null y márcalo en uncertainFields.
- days: números ISO 1=lunes … 7=domingo. Si una materia cae varios días con el mismo horario, UN objeto con varios days. Si el horario cambia por día, objetos separados.
- startTime y endTime en 24 horas HH:mm (ej. 08:00, 14:30). Si solo hay una hora, deja la otra en null y márcala incierta.
- location es el aula/salón. professor es el nombre del docente. section es grupo/sección. courseCode es el código (ej. EIF-200).
- extra: otra info útil breve (edificio, modalidad), o null.
- Si el documento está borroso, es una tabla confusa o no parece un horario, explícalo en documentWarning. Aun así extrae lo que sí se lea.
- issue: frase corta en español si ESA clase necesita revisión (horario ilegible, días dudosos, etc.), o null.

Idioma de documentWarning e issue: español, breve.`;

function coerceDays(values: Array<number | string>): number[] {
  const days: number[] = [];
  for (const value of values) {
    try {
      const day = typeof value === "number" ? value : parseDayOfWeek(String(value));
      if (day >= 1 && day <= 7) days.push(day);
    } catch {
      // Día ilegible: no inventar.
    }
  }
  return [...new Set(days)].sort((a, b) => a - b);
}

function toDraft(row: z.infer<typeof extractedClassSchema>): ScheduleDraft {
  const startTime = normalizeTime(row.startTime) ?? "";
  const endTime = normalizeTime(row.endTime) ?? "";
  const days = coerceDays(row.days ?? []);
  const uncertain: ScheduleDraft["uncertain"] = {};
  for (const field of row.uncertainFields ?? []) {
    uncertain[field] = true;
  }
  if (!row.title?.trim()) uncertain.title = true;
  if (days.length === 0) uncertain.days = true;
  if (!startTime) uncertain.startTime = true;
  if (!endTime) uncertain.endTime = true;
  const issues = row.issue?.trim() ? [row.issue.trim()] : [];

  return emptyDraft({
    title: row.title?.trim() ?? "",
    days,
    startTime,
    endTime,
    professor: row.professor?.trim() ?? "",
    location: row.location?.trim() ?? "",
    section: row.section?.trim() ?? "",
    courseCode: row.courseCode?.trim() ?? "",
    extra: row.extra?.trim() ?? "",
    uncertain,
    issues,
    duplicateAction: "create",
  });
}

export async function parseScheduleDocument(input: {
  data: Uint8Array;
  mediaType: string;
}): Promise<ParseDocumentResult> {
  const filePart =
    input.mediaType === "application/pdf"
      ? { type: "file" as const, data: input.data, mediaType: input.mediaType, filename: "horario.pdf" }
      : { type: "image" as const, image: input.data, mediaType: input.mediaType };

  const result = await generateText({
    model: geminiFlash(),
    output: Output.object({ schema: parseOutputSchema }),
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: PARSE_PROMPT }, filePart],
      },
    ],
  });

  const output = result.output;
  if (!output) {
    throw new Error("No pude leer el horario. Intenta con otra foto o un PDF más nítido.");
  }

  const classes = output.classes
    .map(toDraft)
    .filter(
      (draft) =>
        draft.title ||
        draft.days.length > 0 ||
        draft.startTime ||
        draft.endTime ||
        draft.professor ||
        draft.location,
    );

  return {
    documentWarning: output.documentWarning?.trim() || null,
    classes,
  };
}
