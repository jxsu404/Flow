import { tool } from "ai";
import { z } from "zod";
import { findItemsByQuery, updateItem } from "@/lib/items";
import type { AgentContext } from "../context";

export function updateItemTool(ctx: AgentContext) {
  return tool({
    description:
      "Actualiza o marca como hecha una tarea/entrega/evento existente. Si no tienes el id, busca por título.",
    inputSchema: z.object({
      id: z.string().optional(),
      query: z.string().optional().describe("Título o fragmento para encontrar el ítem"),
      title: z.string().optional(),
      type: z.enum(["task", "assignment", "exam", "event"]).optional(),
      dueAt: z.string().optional(),
      startAt: z.string().optional(),
      endAt: z.string().optional(),
      durationMinutes: z.number().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      status: z.enum(["pending", "done", "cancelled"]).optional(),
      notes: z.string().optional(),
    }),
    execute: async (input) => {
      let id = input.id;
      if (!id && input.query) {
        const matches = await findItemsByQuery(ctx.userId, input.query);
        if (matches.length === 0) {
          return { ok: false, error: `No encontré nada parecido a "${input.query}"` };
        }
        if (matches.length > 1) {
          return {
            ok: false,
            error: "Hay varias coincidencias; elige un id",
            matches: matches.map((item) => ({ id: item.id, title: item.title, type: item.type })),
          };
        }
        id = matches[0]?.id;
      }
      if (!id) return { ok: false, error: "Necesito id o query" };
      const result = await updateItem(ctx.userId, ctx.timeZone, id, input);
      if (!result) return { ok: false, error: "No existe ese ítem" };
      return {
        ok: true,
        id: result.item.id,
        title: result.item.title,
        status: result.item.status,
        calendarSynced: result.calendarSynced,
      };
    },
  });
}
