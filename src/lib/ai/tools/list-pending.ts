import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { tool } from "ai";
import { z } from "zod";
import { listItems } from "@/lib/items";
import { listClassBlocks } from "@/lib/classes";
import type { AgentContext } from "../context";

export function listPendingTool(ctx: AgentContext) {
  return tool({
    description:
      "Lista lo pendiente: tareas, entregas, exámenes y clases. Úsala para consultas como qué tengo pendiente o qué hay hoy.",
    inputSchema: z.object({
      scope: z.enum(["all", "today", "upcoming"]).optional(),
    }),
    execute: async ({ scope = "all" }) => {
      const [pending, classes] = await Promise.all([
        listItems(ctx.userId, "pending"),
        listClassBlocks(ctx.userId),
      ]);
      const now = new Date();
      const today = formatInTimeZone(now, ctx.timeZone, "yyyy-MM-dd");
      const weekEnd = addDays(now, 7);

      const filtered = pending.filter((item) => {
        if (scope === "all") return true;
        const date = item.dueAt ?? item.startAt;
        if (!date) return scope !== "today";
        if (scope === "today") {
          return formatInTimeZone(date, ctx.timeZone, "yyyy-MM-dd") === today;
        }
        return date <= weekEnd;
      });

      return {
        items: filtered.map((item) => ({
          id: item.id,
          title: item.title,
          type: item.type,
          priority: item.priority,
          dueAt: item.dueAt?.toISOString() ?? null,
        })),
        classes: classes.map((block) => ({
          id: block.id,
          title: block.title,
          dayOfWeek: block.dayOfWeek,
          startTime: block.startTime,
          endTime: block.endTime,
        })),
      };
    },
  });
}
