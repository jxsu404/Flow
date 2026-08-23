import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import {
  CalendarCheck,
  CalendarClock,
  CalendarRange,
  ChevronRight,
  Clock,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ItemRow, SubjectGlyphBox } from "@/components/dashboard-rows";
import { PeriodTimeline } from "@/components/period-timeline";
import { TodayHero } from "@/components/today-hero";
import { WeatherChip } from "@/components/weather-chip";
import { WeekSchedule } from "@/components/week-schedule";
import { DAY_PARTS } from "@/lib/availability";
import type { DashboardData } from "@/lib/dashboard";
import { interpretToday } from "@/lib/today-insight";
import { greetingFor } from "@/lib/today-phrase";
import { cn } from "@/lib/utils";

const LIST_PREVIEW = 3;
const FREE_PREVIEW = 2;
const WEEK_HORIZON_DAYS = 7;

function minutesFromAwake(hm: string): number {
  const [hours, minutes] = hm.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0) - 7 * 60;
}

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}h ${rest}m`;
  if (hours) return `${hours}h`;
  return `${rest} min`;
}

function firstName(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first || null;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
      <Icon className="size-3.5 text-primary" />
      {children}
    </p>
  );
}

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-border/60 bg-card px-4 py-4 md:px-5", className)}>
      {children}
    </section>
  );
}

export function DashboardView({ data }: { data: DashboardData }) {
  const now = new Date();
  const nowHm = formatInTimeZone(now, data.timeZone, "HH:mm");
  const busy = (data.todayPlan?.segments ?? [])
    .filter((segment) => segment.type === "busy")
    .map((segment) => ({
      title: segment.title,
      kind: segment.kind,
      start: segment.start,
      end: segment.end,
    }));

  const insight = interpretToday({
    now,
    timeZone: data.timeZone,
    items: data.items,
    busy,
    weather: data.weather,
  });

  const partDefinition = DAY_PARTS.find((part) => part.id === insight.part.id) ?? DAY_PARTS[1];
  const windowStartMin = minutesFromAwake(partDefinition.start);
  const windowSpanMin = minutesFromAwake(partDefinition.end) - windowStartMin;
  const partSegments =
    data.weekDays
      .find((day) => day.isToday)
      ?.parts.find((part) => part.part === insight.part.label)?.segments ?? [];

  const freeBlocks = (data.todayPlan?.segments ?? [])
    .filter((segment) => segment.type === "free" && segment.end.getTime() > now.getTime())
    .map((segment) => ({
      rangeLabel: segment.rangeLabel,
      minutes: Math.round((segment.end.getTime() - segment.start.getTime()) / 60_000),
      suggestion: segment.type === "free" ? segment.suggestion : null,
    }));

  const remainingClasses = busy.filter(
    (block) => block.kind === "class" && block.end.getTime() > now.getTime(),
  ).length;
  const dueToday = data.pendingItems.filter(
    (item) => item.dueAt && formatInTimeZone(item.dueAt, data.timeZone, "yyyy-MM-dd") === data.today,
  ).length;
  const nextWeek = data.upcoming.filter((item) => {
    if (!item.dueAt) return false;
    const days = Math.round((item.dueAt.getTime() - now.getTime()) / 86_400_000);
    return days >= 0 && days <= WEEK_HORIZON_DAYS;
  }).length;

  const supportParts: string[] = [];
  if (remainingClasses === 1) supportParts.push("te queda 1 clase hoy");
  else if (remainingClasses > 1) supportParts.push(`te quedan ${remainingClasses} clases hoy`);
  if (dueToday === 1) supportParts.push("1 entrega para hoy");
  else if (dueToday > 1) supportParts.push(`${dueToday} entregas para hoy`);
  if (supportParts.length === 0 && nextWeek > 0) {
    supportParts.push(
      nextWeek === 1 ? "1 entrega en los próximos 7 días" : `${nextWeek} entregas en los próximos 7 días`,
    );
  }
  const support = supportParts.length ? capitalize(`${supportParts.join(" y ")}.`) : null;

  const pendingWork = data.upcoming
    .filter((item) => item.type === "task" || item.type === "assignment")
    .slice(0, LIST_PREVIEW);
  const nextEvents = data.upcoming
    .filter((item) => item.type === "exam" || item.type === "event")
    .slice(0, LIST_PREVIEW);
  const greeting = greetingFor(insight.part);
  const name = firstName(data.userName);
  const CalendarIcon = data.calendarConnected ? CalendarCheck : CalendarClock;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-tight font-semibold tracking-tight md:text-2xl">
            ¡{greeting}
            {name ? `, ${name}` : ""}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{data.todayLongLabel}</p>
        </div>
        {data.weather ? <WeatherChip weather={data.weather} className="shrink-0" /> : null}
      </header>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <TodayHero insight={insight} weather={data.weather} support={support} />

          {partSegments.length > 0 ? (
            <PeriodTimeline
              label={insight.part.label}
              segments={partSegments}
              windowStartMin={windowStartMin}
              windowSpanMin={windowSpanMin}
              nowMin={minutesFromAwake(nowHm)}
            />
          ) : null}

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Panel>
              <SectionTitle icon={ListChecks}>Tareas pendientes</SectionTitle>
              <div className="mt-2">
                {pendingWork.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">No tienes tareas con fecha.</p>
                ) : (
                  pendingWork.map((item) => (
                    <ItemRow key={item.id} item={item} today={data.today} timeZone={data.timeZone} />
                  ))
                )}
              </div>
              <Button variant="ghost" size="sm" className="mt-2 h-8 px-0 text-primary" asChild>
                <Link href="/app/tareas">
                  Ver todas mis tareas
                  <ChevronRight />
                </Link>
              </Button>
            </Panel>

            <Panel>
              <SectionTitle icon={CalendarRange}>Próximos eventos</SectionTitle>
              <div className="mt-2">
                {nextEvents.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">Nada agendado por ahora.</p>
                ) : (
                  nextEvents.map((item) => (
                    <ItemRow key={item.id} item={item} today={data.today} timeZone={data.timeZone} />
                  ))
                )}
              </div>
              <Button variant="ghost" size="sm" className="mt-2 h-8 px-0 text-primary" asChild>
                <Link href="/app/horario">
                  Ver calendario
                  <ChevronRight />
                </Link>
              </Button>
            </Panel>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel>
            <SectionTitle icon={Sparkles}>Lo importante hoy</SectionTitle>
            {insight.subject ? (
              <>
                <div className="mt-3 flex items-start gap-3">
                  <SubjectGlyphBox title={insight.subject.title} kind="task" />
                  <div className="min-w-0">
                    <p className="text-sm leading-snug font-medium">{insight.subject.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{insight.subject.meta}</p>
                  </div>
                </div>
                <Button className="mt-4 w-full" asChild>
                  <Link href={insight.subject.href}>
                    {insight.subject.cta}
                    <ChevronRight />
                  </Link>
                </Button>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Nada urgente ahora. Cuando algo se acerque, aparecerá aquí.
              </p>
            )}
          </Panel>

          <Panel>
            <SectionTitle icon={Clock}>Tu tiempo disponible</SectionTitle>
            {freeBlocks.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No queda espacio libre en tu {insight.part.label.toLowerCase()}.
              </p>
            ) : (
              <>
                <p className="mt-2.5 text-sm leading-relaxed">
                  {freeBlocks[0]!.suggestion
                    ? `Puedes usar ${freeBlocks[0]!.rangeLabel.replace(/ – /g, "–")} para avanzar en ${freeBlocks[0]!.suggestion.title}.`
                    : `Te quedan ${durationLabel(freeBlocks.reduce((total, block) => total + block.minutes, 0))} de espacio hoy.`}
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {freeBlocks.slice(0, FREE_PREVIEW).map((block) => (
                    <div
                      key={block.rangeLabel}
                      className="flex items-center gap-2.5 rounded-lg bg-secondary/40 px-3 py-2"
                    >
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      <span className="font-mono text-xs tabular-nums">
                        {block.rangeLabel.replace(/ – /g, "–")}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {durationLabel(block.minutes)} disponibles
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <Button variant="ghost" size="sm" className="mt-2 h-8 px-0 text-primary" asChild>
              <Link href="/app/horario">
                Ver horario completo
                <ChevronRight />
              </Link>
            </Button>
          </Panel>

          <Panel>
            <div className="flex items-start gap-3">
              <CalendarIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Google Calendar</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {data.calendarConnected
                    ? "Conectado y sincronizado."
                    : "Sin permisos de Calendar. Vuelve a entrar con Google."}
                </p>
                <Badge
                  variant={data.calendarConnected ? "default" : "secondary"}
                  className="mt-2 h-5 tracking-wide"
                >
                  {data.calendarConnected ? "Sincronizado" : "Pendiente"}
                </Badge>
              </div>
            </div>
          </Panel>
        </div>
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
    </div>
  );
}
