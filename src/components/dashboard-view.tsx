import { formatInTimeZone } from "date-fns-tz";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeadlineRow } from "@/components/deadline-list";
import { WeekSchedule } from "@/components/week-schedule";
import type { Item } from "@/db/schema";
import type { DashboardData } from "@/lib/dashboard";
import type { DayPlan, DaySegment } from "@/lib/day-plan";
import { cn } from "@/lib/utils";

const busyKindLabel: Record<string, string> = {
  class: "Clase",
  exam: "Examen",
  event: "Evento",
  calendar: "Calendar",
  assignment: "Entrega",
  task: "Tarea",
};

function ItemRow({ item, timeZone }: { item: Item; timeZone: string }) {
  const when = item.dueAt
    ? formatInTimeZone(item.dueAt, timeZone, "EEE d MMM HH:mm")
    : item.startAt
      ? formatInTimeZone(item.startAt, timeZone, "EEE d MMM HH:mm")
      : "Sin fecha";
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-3 last:border-0">
      <div>
        <p className="font-medium leading-tight">{item.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{when}</p>
      </div>
    </div>
  );
}

function SegmentBlock({ segment }: { segment: DaySegment }) {
  const isFree = segment.type === "free";
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2",
        isFree
          ? "border border-dashed border-border bg-muted/30"
          : "bg-secondary",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium leading-tight">
          {isFree ? "Libre" : segment.title}
        </p>
        <p className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {segment.rangeLabel}
        </p>
      </div>
      {isFree && segment.suggestion ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Puedes {segment.suggestion.type === "assignment" ? "avanzar" : "hacer"}{" "}
          {segment.suggestion.title} · {segment.suggestion.dueLabel}
        </p>
      ) : null}
      {!isFree ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {busyKindLabel[segment.kind] ?? segment.kind}
        </p>
      ) : null}
    </div>
  );
}

function DayTimeline({ plan, compact = false }: { plan: DayPlan; compact?: boolean }) {
  const parts = ["Mañana", "Tarde", "Noche"] as const;
  const grouped = parts
    .map((part) => ({
      part,
      segments: plan.segments.filter((segment) => segment.partLabel === part),
    }))
    .filter((group) => group.segments.length > 0);

  return (
    <div className={cn("flex flex-col gap-3", compact && "gap-2")}>
      <div>
        <p className={cn("font-medium", compact ? "text-sm" : "text-base")}>{plan.heading}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{plan.summary}</p>
      </div>
      {grouped.map((group) => (
        <div key={group.part} className="flex flex-col gap-1.5">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {group.part}
          </p>
          {group.segments.map((segment) => (
            <SegmentBlock
              key={`${segment.type}-${segment.start.toISOString()}`}
              segment={segment}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DashboardView({ data }: { data: DashboardData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Hoy · {data.todayLabel}</CardTitle>
          <CardDescription>
            Clases, Calendar y lo que ya tiene hora. El resto se sugiere en los bloques libres.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {data.todayPlan ? <DayTimeline plan={data.todayPlan} /> : (
            <p className="text-sm text-muted-foreground">No pude armar el día de hoy.</p>
          )}
          {data.todayItems.length > 0 ? (
            <div>
              <p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Vence o empieza hoy
              </p>
              {data.todayItems.map((item) => (
                <ItemRow key={item.id} item={item} timeZone={data.timeZone} />
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entregas y exámenes</CardTitle>
          <CardDescription>
            Tareas, proyectos y exámenes con etiqueta de tipo y de urgencia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay entregas próximas.</p>
          ) : (
            data.upcoming.map((item) => (
              <DeadlineRow
                key={item.id}
                item={item}
                today={data.today}
                timeZone={data.timeZone}
              />
            ))
          )}
        </CardContent>
      </Card>

      <WeekSchedule days={data.weekDays} />

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Google Calendar</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4 text-sm">
          <p className="text-muted-foreground">
            {data.calendarConnected
              ? "Conectado. Los eventos y recordatorios se crean en tu calendario principal."
              : "No pude confirmar permisos de Calendar. Vuelve a entrar con Google y acepta el acceso a eventos."}
          </p>
          <Badge variant={data.calendarConnected ? "default" : "secondary"}>
            {data.calendarConnected ? "Sincronizado" : "Pendiente"}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
