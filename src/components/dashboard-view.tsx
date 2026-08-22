import { formatInTimeZone } from "date-fns-tz";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Item } from "@/db/schema";
import type { DashboardData } from "@/lib/dashboard";
import type { DayPlan, DaySegment } from "@/lib/day-plan";
import { cn } from "@/lib/utils";

const typeLabel: Record<Item["type"], string> = {
  task: "Tarea",
  assignment: "Entrega",
  exam: "Examen",
  event: "Evento",
};

const priorityLabel: Record<Item["priority"], string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

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
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge variant="secondary">{typeLabel[item.type]}</Badge>
        {item.priority === "high" ? <Badge>{priorityLabel[item.priority]}</Badge> : null}
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
          <CardTitle>Qué hacer primero</CardTitle>
        </CardHeader>
        <CardContent>
          {data.priorities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin prioridades todavía.</p>
          ) : (
            data.priorities.map((item) => (
              <ItemRow key={item.id} item={item} timeZone={data.timeZone} />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entregas y exámenes</CardTitle>
        </CardHeader>
        <CardContent>
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay entregas próximas.</p>
          ) : (
            data.upcoming.map((item) => (
              <ItemRow key={item.id} item={item} timeZone={data.timeZone} />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bloques de la semana</CardTitle>
          <CardDescription>
            Tiempo libre en bloques, no en minutos. De 22:00 a 07:00 cuenta como descanso.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {data.weekPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay más días en el rango.</p>
          ) : (
            data.weekPlans.map((plan) => (
              <DayTimeline key={plan.date} plan={plan} compact />
            ))
          )}
        </CardContent>
      </Card>

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
