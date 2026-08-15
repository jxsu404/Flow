import { tool } from "ai";
import { z } from "zod";
import { createItem } from "@/lib/items";
import type { AgentContext } from "../context";

export function createItemTool(ctx: AgentContext) {
  return tool({
    description:
      "Crea una tarea, entrega, examen o evento. Úsala cuando el usuario menciona algo que debe hacer, entregar, presentar o agendar.",
    inputSchema: z.object({
      title: z.string().describe("Título corto"),
      type: z
        .enum(["task", "assignment", "exam", "event"])
        .describe("task=tarea/estudio, assignment=entrega, exam=examen, event=evento"),
      dueAt: z
        .string()
        .optional()
        .describe("Fecha/hora ISO local, p. ej. 2026-08-18T16:00"),
      startAt: z.string().optional().describe("Inicio ISO si ocupa un horario"),
      endAt: z.string().optional().describe("Fin ISO"),
      durationMinutes: z.number().optional().describe("Duración en minutos"),
      priority: z.enum(["low", "medium", "high"]).optional(),
      notes: z.string().optional(),
    }),
    execute: async (input) => {
      const { item, calendarSynced } = await createItem(ctx.userId, ctx.timeZone, {
        ...input,
        source: ctx.source,
      });
      return {
        ok: true,
        id: item.id,
        title: item.title,
        type: item.type,
        dueAt: item.dueAt?.toISOString() ?? null,
        priority: item.priority,
        calendarSynced,
      };
    },
  });
}
