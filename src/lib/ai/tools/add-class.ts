import { tool } from "ai";
import { z } from "zod";
import { createClassBlock } from "@/lib/classes";
import type { AgentContext } from "../context";

export function addClassTool(ctx: AgentContext) {
  return tool({
    description:
      "Registra una clase recurrente del horario semanal. Ejemplo: lunes matemáticas 8:00 a 10:00.",
    inputSchema: z.object({
      title: z.string(),
      dayOfWeek: z
        .string()
        .describe("Día en español o número ISO 1-7 (1=lunes)"),
      startTime: z.string().describe("HH:mm 24h, p. ej. 08:00"),
      endTime: z.string().describe("HH:mm 24h, p. ej. 10:00"),
      location: z.string().optional(),
    }),
    execute: async (input) => {
      const { block, calendarSynced } = await createClassBlock(ctx.userId, ctx.timeZone, input);
      return {
        ok: true,
        id: block.id,
        title: block.title,
        dayOfWeek: block.dayOfWeek,
        startTime: block.startTime,
        endTime: block.endTime,
        calendarSynced,
      };
    },
  });
}
