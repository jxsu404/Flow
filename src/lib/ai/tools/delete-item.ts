import { tool } from "ai";
import { z } from "zod";
import { deleteItem, findItemsByQuery } from "@/lib/items";
import type { AgentContext } from "../context";

export function deleteItemTool(ctx: AgentContext) {
  return tool({
    description: "Elimina una tarea, entrega, examen o evento. Busca por título si no hay id.",
    inputSchema: z.object({
      id: z.string().optional(),
      query: z.string().optional(),
    }),
    execute: async (input) => {
      let id = input.id;
      if (!id && input.query) {
        const matches = await findItemsByQuery(ctx.userId, input.query);
        if (matches.length === 0) {
          return { ok: false, error: `No encontré "${input.query}"` };
        }
        if (matches.length > 1) {
          return {
            ok: false,
            matches: matches.map((item) => ({ id: item.id, title: item.title })),
          };
        }
        id = matches[0]?.id;
      }
      if (!id) return { ok: false, error: "Necesito id o query" };
      const deleted = await deleteItem(ctx.userId, id);
      if (!deleted) return { ok: false, error: "No existe ese ítem" };
      return { ok: true, title: deleted.title };
    },
  });
}
