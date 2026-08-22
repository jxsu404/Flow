import { addDays } from "date-fns";
import { tool } from "ai";
import { z } from "zod";
import { AWAKE_END, AWAKE_START } from "@/lib/availability";
import { listCalendarBusy } from "@/lib/calendar/google";
import { listClassBlocks } from "@/lib/classes";
import { buildDayPlans } from "@/lib/day-plan";
import { listItems } from "@/lib/items";
import { parseUserDateTime } from "@/lib/datetime";
import type { AgentContext } from "../context";

export function findFreeTimeTool(ctx: AgentContext) {
  return tool({
    description:
      "Arma el día en bloques (mañana / tarde / noche) con lo ocupado y lo libre. Combina clases, Calendar y actividades con hora. Sugiere entregas o tareas próximas en los huecos. Úsala para tiempo libre, qué hacer hoy o cuándo hay espacio.",
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
      const days = buildDayPlans({
        from,
        to,
        timeZone: ctx.timeZone,
        classBlocks: classes,
        items,
        calendarBusy,
      }).slice(0, 8);

      return {
        awakeHours: { start: AWAKE_START, end: AWAKE_END },
        note: "No hables de minutos totales. Describe bloques (Mañana 07:00 – 12:00). 22:00–07:00 es descanso. Si no hay nada fijo pero hay una entrega próxima, sugiere usarla en un bloque libre.",
        days: days.map((day) => ({
          date: day.date,
          heading: day.heading,
          isToday: day.isToday,
          summary: day.summary,
          blocks: day.segments.map((segment) =>
            segment.type === "free"
              ? {
                  type: "free" as const,
                  part: segment.partLabel,
                  range: segment.rangeLabel,
                  suggestion: segment.suggestion
                    ? {
                        title: segment.suggestion.title,
                        due: segment.suggestion.dueLabel,
                        type: segment.suggestion.type,
                      }
                    : null,
                }
              : {
                  type: "busy" as const,
                  part: segment.partLabel,
                  range: segment.rangeLabel,
                  title: segment.title,
                  kind: segment.kind,
                },
          ),
        })),
      };
    },
  });
}
