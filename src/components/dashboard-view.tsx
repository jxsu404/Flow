import Link from "next/link";
import { CalendarCheck, CalendarClock, CalendarDays, ChevronRight, CloudSun, Moon, Sparkles, Sun, Timer } from "lucide-react";
import { OccupancyRing, TimeRibbon } from "@/components/time-ribbon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeadlineRow } from "@/components/deadline-list";
import { WeekSchedule } from "@/components/week-schedule";
import { DAY_PARTS } from "@/lib/availability";
import { daySegments } from "@/lib/calendar-grid";
import { clockInZone } from "@/lib/clock";
import type { DashboardData } from "@/lib/dashboard";
import { dayInsight, suggestionPrompt, type DayPlan, type DaySegment } from "@/lib/day-plan";
import { subjectTone } from "@/lib/subject-color";
import { cn } from "@/lib/utils";

const partIcons = {
  Mañana: Sun,
  Tarde: CloudSun,
  Noche: Moon,
} as const;

function compactRange(label: string) {
  return label.replace(/ – /g, "–");
}

function planOccupancy(plan: DayPlan): { pct: number; busyCount: number; hasSuggestion: boolean } {
  let busyMin = 0;
  let freeMin = 0;
  let busyCount = 0;
  let hasSuggestion = false;
  for (const segment of plan.segments) {
    const minutes = Math.max(0, (segment.end.getTime() - segment.start.getTime()) / 60_000);
    if (segment.type === "busy") {
      busyMin += minutes;
      busyCount += 1;
    } else {
      freeMin += minutes;
      if (segment.suggestion) hasSuggestion = true;
    }
  }
  const total = busyMin + freeMin;
  return { pct: total === 0 ? 0 : Math.round((busyMin / total) * 100), busyCount, hasSuggestion };
}

function partDefaultRange(part: string): string {
  const found = DAY_PARTS.find((item) => item.label === part);
  if (!found) return "";
  return `${found.start} – ${found.end}`;
}

function spanLabel(segments: DaySegment[], fallback: string): string {
  if (segments.length === 0) return compactRange(fallback);
  const start = segments[0]?.rangeLabel.split(" – ")[0] ?? "";
  const end = segments.at(-1)?.rangeLabel.split(" – ").at(-1) ?? "";
  return compactRange(`${start} – ${end}`);
}

function PartCard({ part, segments }: { part: keyof typeof partIcons; segments: DaySegment[] }) {
  const Icon = partIcons[part];
  const busy = segments.filter((segment): segment is Extract<DaySegment, { type: "busy" }> => segment.type === "busy");
  const free = segments.filter((segment): segment is Extract<DaySegment, { type: "free" }> => segment.type === "free");
  const range = spanLabel(segments, partDefaultRange(part));
  const suggestion = free.find((segment) => segment.suggestion)?.suggestion;
  const pastEmpty = segments.length === 0;
  const tone = busy[0] ? subjectTone(busy[0].title, busy[0].kind) : null;

  return (
    <div
      className={cn(
        "rounded-xl bg-secondary/50 px-3 py-2.5 ring-1 ring-foreground/8",
        tone && `border-l-2 ${tone.accent}`,
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        <p className="text-xs font-medium tracking-wide text-foreground uppercase">{part}</p>
      </div>
      <p className="mt-1.5 font-mono text-xs tabular-nums text-muted-foreground">{range}</p>
      {pastEmpty ? (
        <p className="mt-1 text-sm text-muted-foreground">Ya pasó</p>
      ) : busy.length === 0 ? (
        <p className="mt-1 text-sm">Libre</p>
      ) : (
        <div className="mt-1 flex flex-col gap-1">
          {busy.slice(0, 2).map((segment) => (
            <div key={`${segment.title}-${segment.start.toISOString()}`}>
              <p className="text-sm font-medium leading-snug">{segment.title}</p>
              <p className="text-xs text-muted-foreground">
                {compactRange(segment.rangeLabel)}
                {segment.location ? ` · ${segment.location}` : ""}
              </p>
            </div>
          ))}
          {busy.length > 2 ? (
            <p className="text-xs text-muted-foreground">+{busy.length - 2} más</p>
          ) : null}
        </div>
      )}
      {suggestion ? <p className="mt-1 text-xs text-muted-foreground">{suggestionPrompt(suggestion)}</p> : null}
    </div>
  );
}

function DayTimeline({ plan }: { plan: DayPlan }) {
  const parts = ["Mañana", "Tarde", "Noche"] as const;
  const insight = dayInsight(plan);
  const occupancy = planOccupancy(plan);
  const freeLead = occupancy.busyCount === 0 ? plan.summary : insight;

  return (
    <div className="flex flex-col gap-3">
      {freeLead ? (
        <div className="flex items-start gap-1.5 text-sm">
          {occupancy.busyCount === 0 ? <Sparkles className="mt-0.5 size-4 shrink-0 text-primary/80" /> : null}
          <div>
            <p className="text-muted-foreground">{freeLead}</p>
            {occupancy.busyCount === 0 && !occupancy.hasSuggestion ? (
              <p className="mt-0.5 text-xs text-muted-foreground">Un buen momento para adelantar tareas.</p>
            ) : null}
          </div>
        </div>
      ) : null}
      <OccupancyRing pct={occupancy.pct} label="Día ocupado" />
      <div className="grid gap-2 sm:grid-cols-3">
        {parts.map((part) => (
          <PartCard
            key={part}
            part={part}
            segments={plan.segments.filter((segment) => segment.partLabel === part)}
          />
        ))}
      </div>
    </div>
  );
}

const UPCOMING_PREVIEW = 5;

export function DashboardView({ data }: { data: DashboardData }) {
  const preview = data.upcoming.slice(0, UPCOMING_PREVIEW);
  const todayDay = data.weekDays.find((day) => day.isToday || day.date === data.today);
  const clock = clockInZone(data.timeZone);
  const CalendarIcon = data.calendarConnected ? CalendarCheck : CalendarClock;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[17px]">
              <CalendarDays className="size-4 text-primary" />
              Hoy
            </CardTitle>
            <CardDescription>{data.todayLabel}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {data.todayPlan ? (
              <DayTimeline plan={data.todayPlan} />
            ) : (
              <p className="text-sm text-muted-foreground">No pude armar el día de hoy.</p>
            )}
            {todayDay ? (
              <TimeRibbon segments={daySegments(todayDay)} nowStartMin={clock.startMin} />
            ) : null}
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
