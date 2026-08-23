import Link from "next/link";
import { CalendarCheck, CalendarClock, CalendarDays, ChevronRight, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeadlineRow } from "@/components/deadline-list";
import { TodayPanel } from "@/components/today-panel";
import { WeekSchedule } from "@/components/week-schedule";
import type { DashboardData } from "@/lib/dashboard";

const UPCOMING_PREVIEW = 5;

export function DashboardView({ data }: { data: DashboardData }) {
  const preview = data.upcoming.slice(0, UPCOMING_PREVIEW);
  const CalendarIcon = data.calendarConnected ? CalendarCheck : CalendarClock;
  const busy = (data.todayPlan?.segments ?? [])
    .filter((segment) => segment.type === "busy")
    .map((segment) => ({
      title: segment.title,
      kind: segment.kind,
      start: segment.start,
      end: segment.end,
    }));

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[17px]">
              <CalendarDays className="size-4 text-primary" />
              Hoy
            </CardTitle>
            <CardDescription>{data.todayLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.todayPlan ? (
              <TodayPanel timeZone={data.timeZone} items={data.pendingItems} busy={busy} />
            ) : (
              <p className="text-sm text-muted-foreground">No pude armar el día de hoy.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[17px]">
              <Timer className="size-4 text-primary" />
              Entregas y exámenes
            </CardTitle>
            <CardDescription>Lo que vence pronto, para escanear de un vistazo.</CardDescription>
          </CardHeader>
          <CardContent>
            {preview.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada urgente en los próximos días.</p>
            ) : (
              preview.map((item) => (
                <DeadlineRow
                  key={item.id}
                  item={item}
                  today={data.today}
                  timeZone={data.timeZone}
                />
              ))
            )}
            {data.upcoming.length > 0 ? (
              <Button variant="ghost" size="sm" className="mt-2 h-8 px-0 text-primary" asChild>
                <Link href="/app/tareas">
                  Ver todos ({data.upcoming.length})
                  <ChevronRight />
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <WeekSchedule
        weekDays={data.weekDays}
        monthDays={data.monthDays}
        today={data.today}
        timeZone={data.timeZone}
        weekLabel={data.weekLabel}
        monthLabel={data.monthLabel}
        month={data.month}
      />

      <div className="flex items-center justify-between gap-4 rounded-xl px-4 py-3 ring-1 ring-foreground/10">
        <div className="flex min-w-0 items-center gap-3">
          <CalendarIcon className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Google Calendar</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {data.calendarConnected
                ? "Conectado y sincronizado con tu calendario principal."
                : "Sin permisos de Calendar. Vuelve a entrar con Google y acepta el acceso a eventos."}
            </p>
          </div>
        </div>
        <Badge variant={data.calendarConnected ? "default" : "secondary"} className="shrink-0">
          {data.calendarConnected ? "Sincronizado" : "Pendiente"}
        </Badge>
      </div>
    </div>
  );
}
