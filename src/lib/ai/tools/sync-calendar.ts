import { addDays } from "date-fns";
import { tool } from "ai";
import { z } from "zod";
import { listCalendarBusy } from "@/lib/calendar/google";
import { isCalendarConnected } from "@/lib/google-token";
import type { AgentContext } from "../context";

export function syncCalendarTool(ctx: AgentContext) {
  return tool({
    description:
      "Comprueba si Google Calendar está conectado y resume los próximos eventos del calendario.",
    inputSchema: z.object({}),
    execute: async () => {
      const connected = await isCalendarConnected(ctx.userId);
      if (!connected) {
        return {
          connected: false,
          message: "Google Calendar no está conectado o faltan permisos de eventos.",
        };
      }
      const events = await listCalendarBusy(ctx.userId, new Date(), addDays(new Date(), 7));
      return {
        connected: true,
        upcoming: events.slice(0, 12).map((event) => ({
          title: event.title,
          start: event.start.toISOString(),
          end: event.end.toISOString(),
        })),
      };
    },
  });
}
