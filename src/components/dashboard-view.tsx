import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeadlineRow } from "@/components/deadline-list";
import { WeekSchedule } from "@/components/week-schedule";
import type { DashboardData } from "@/lib/dashboard";
import { dayInsight, suggestionPrompt, type DayPlan, type DaySegment } from "@/lib/day-plan";

const busyKindLabel: Record<string, string> = {
  class: "Clase",
  exam: "Examen",
  event: "Evento",
  calendar: "Calendar",
  assignment: "Entrega",
  task: "Tarea",
};

function compactRange(label: string) {
  return label.replace(/ – /g, "–");
}

function FreeLine({ segment }: { segment: Extract<DaySegment, { type: "free" }> }) {
  return (
    <div className="py-0.5">
      <p className="text-sm text-muted-foreground">
        Libre · {compactRange(segment.rangeLabel)}
      </p>
      {segment.suggestion ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{suggestionPrompt(segment.suggestion)}</p>
      ) : null}
    </div>
  );
}

function BusyLine({ segment }: { segment: Extract<DaySegment, { type: "busy" }> }) {
  return (
    <div className="rounded-lg bg-secondary px-2.5 py-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium leading-snug">{segment.title}</p>
        <p className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {compactRange(segment.rangeLabel)}
        </p>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{busyKindLabel[segment.kind] ?? segment.kind}</p>
    </div>
  );
}

function PartSection({
  part,
  segments,
}: {
  part: string;
  segments: DaySegment[];
}) {
  const allFree = segments.every((segment) => segment.type === "free");
  if (allFree) {
    const range = segments.map((segment) => compactRange(segment.rangeLabel)).join(" · ");
    const suggestion = segments.find((segment) => segment.type === "free" && segment.suggestion);
    return (
      <div>
        <p className="text-sm">
          <span className="font-medium">{part}</span>
          <span className="text-muted-foreground"> · Libre · {range}</span>
        </p>
        {suggestion?.type === "free" && suggestion.suggestion ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{suggestionPrompt(suggestion.suggestion)}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{part}</p>
      {segments.map((segment) =>
        segment.type === "free" ? (
          <FreeLine key={`free-${segment.start.toISOString()}`} segment={segment} />
        ) : (
          <BusyLine key={`busy-${segment.start.toISOString()}`} segment={segment} />
        ),
      )}
    </div>
  );
}

function DayTimeline({ plan }: { plan: DayPlan }) {
  const parts = ["Mañana", "Tarde", "Noche"] as const;
  const grouped = parts
    .map((part) => ({
      part,
      segments: plan.segments.filter((segment) => segment.partLabel === part),
    }))
    .filter((group) => group.segments.length > 0);
  const insight = dayInsight(plan);
  const lead = insight ?? plan.summary;

  return (
    <div className="flex flex-col gap-3">
      {lead ? <p className="text-sm text-muted-foreground">{lead}</p> : null}
      {grouped.map((group) => (
        <PartSection key={group.part} part={group.part} segments={group.segments} />
      ))}
    </div>
  );
}

export function DashboardView({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-[17px]">Hoy</CardTitle>
            <CardDescription>{data.todayLabel}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {data.todayPlan ? (
              <DayTimeline plan={data.todayPlan} />
            ) : (
              <p className="text-sm text-muted-foreground">No pude armar el día de hoy.</p>
            )}
            {data.todayItems.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Vence o empieza hoy
                </p>
                {data.todayItems.map((item) => (
                  <DeadlineRow
                    key={item.id}
                    item={item}
                    today={data.today}
                    timeZone={data.timeZone}
                  />
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[17px]">Entregas y exámenes</CardTitle>
            <CardDescription>Lo que vence pronto, para escanear de un vistazo.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada urgente en los próximos días.</p>
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
      </div>

      <WeekSchedule days={data.weekDays} />

      <div className="flex items-center justify-between gap-4 rounded-xl px-4 py-3 ring-1 ring-foreground/10">
        <div className="min-w-0">
          <p className="text-sm font-medium">Google Calendar</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {data.calendarConnected
              ? "Conectado y sincronizado."
              : "Sin permisos de Calendar. Vuelve a entrar con Google y acepta el acceso a eventos."}
          </p>
        </div>
        <Badge variant={data.calendarConnected ? "default" : "secondary"} className="shrink-0">
          {data.calendarConnected ? "Sincronizado" : "Pendiente"}
        </Badge>
      </div>
    </div>
  );
}
