import { createGoogle } from "@ai-sdk/google";
import { ToolLoopAgent, isStepCount } from "ai";
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";
import { geminiApiKey } from "@/lib/env";
import type { AgentContext } from "./context";
import { addClassTool } from "./tools/add-class";
import { createItemTool } from "./tools/create-item";
import { deleteItemTool } from "./tools/delete-item";
import { findFreeTimeTool } from "./tools/find-free-time";
import { listPendingTool } from "./tools/list-pending";
import { syncCalendarTool } from "./tools/sync-calendar";
import { updateItemTool } from "./tools/update-item";

export function hasGemini() {
  return Boolean(geminiApiKey());
}

function googleProvider() {
  const apiKey = geminiApiKey();
  if (!apiKey) {
    throw new Error("Falta GEMINI_API_KEY (Google AI Studio, plan gratuito).");
  }
  return createGoogle({ apiKey });
}

export function createFlowAgent(ctx: AgentContext) {
  const now = new Date();
  const when = formatInTimeZone(now, ctx.timeZone, "EEEE d 'de' MMMM yyyy, HH:mm", {
    locale: es,
  });

  return new ToolLoopAgent({
    model: googleProvider()("gemini-2.5-flash"),
    instructions: `Eres Flow, una app de organización personal en español (Costa Rica).
Zona horaria del usuario: ${ctx.timeZone}.
Ahora mismo es ${when}.

Convierte lo que dice el usuario en acciones concretas usando las tools.
Responde siempre en español, breve y claro: confirma qué creaste, cambiaste o encontraste.

Reglas:
- Entrega / proyecto para una fecha = type assignment.
- Examen = type exam. Si también pide estudiar N horas, crea ADEMÁS una task de estudio con durationMinutes.
- Evento con hora = type event con startAt y endAt (o durationMinutes).
- Tarea genérica = type task.
- "bastante importante", "urgente", "prioridad alta" = priority high. Si no dicen nada, medium.
- Horas como "las cuatro", "a las 5" en contexto de tarde/entrega suelen ser 16:00 / 17:00. Mañana = 08:00–11:59.
- Fechas relativas ("el jueves", "próximo martes") resuélvelas con la fecha actual.
- Para cambiar o borrar, busca primero con query si no tienes id.
- Horario de clases (lunes matemáticas 8 a 10) usa add_class, no create_item.
- Preguntas de tiempo libre usan find_free_time. No inventes huecos.
- No programes automáticamente tareas dentro de huecos; solo infórmalos.
- Si Calendar no sincroniza, igual guarda en Flow y dilo con honestidad.
- Tras las tools, resume en una o dos frases lo que quedó organizado.`,
    tools: {
      create_item: createItemTool(ctx),
      update_item: updateItemTool(ctx),
      delete_item: deleteItemTool(ctx),
      list_pending: listPendingTool(ctx),
      add_class: addClassTool(ctx),
      find_free_time: findFreeTimeTool(ctx),
      sync_calendar: syncCalendarTool(ctx),
    },
    stopWhen: isStepCount(8),
  });
}
