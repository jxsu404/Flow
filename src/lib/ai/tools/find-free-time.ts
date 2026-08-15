import { addDays } from "date-fns";
import { tool } from "ai";
import { z } from "zod";
import { findFreeSlots } from "@/lib/availability";
import { listCalendarBusy } from "@/lib/calendar/google";
import { listClassBlocks } from "@/lib/classes";
import { listItems } from "@/lib/items";
import { parseUserDateTime } from "@/lib/datetime";
import type { AgentContext } from "../context";

export function findFreeTimeTool(ctx: AgentContext) {
  return tool({
    description:
      "Calcula huecos libres combinando clases, Google Calendar y tareas con horario. Úsala cuando pregunten cuándo tienen tiempo o qué huecos hay mañana.",
    inputSchema: z.object({
      from: z.string().optional().describe("Inicio ISO; por defecto ahora"),
      to: z.string().optional().describe("Fin ISO; por defecto 7 días"),
    }),
    execute: async (input) => {
      const from = input.from ? parseUserDateTime(input.from, ctx.timeZone) : new Date();
      const to = input.to ? parseUserDateTime(input.to, ctx.timeZone) : addDays(from, 7);
      const [classes, items, calendarBusy] = await Promise.all([
        listClassBlocks(ctx.userId),
        listItems(ctx.userId, "pending"),
        listCalendarBusy(ctx.userId, from, to).catch(() => []),
      ]);
      const slots = findFreeSlots({
        from,
        to,
        timeZone: ctx.timeZone,
        classBlocks: classes,
        items,
        calendarBusy,
      }).slice(0, 10);
      return {
        slots: slots.map((slot) => ({
          label: slot.label,
          minutes: slot.minutes,
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
        })),
      };
    },
  });
}
