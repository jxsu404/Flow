"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Atom,
  BookOpen,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Code,
  Database,
  GraduationCap,
  ListTodo,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HOUR_HEIGHT,
  blockLayout,
  busyBlocksFromDay,
  dayHasBusy,
  formatHour,
  formatMinutesLabel,
  gridHours,
  legendFromDays,
  nowLineTopFromClock,
  occupancy,
  weekStats,
  type CalendarBlock,
} from "@/lib/calendar-grid";
import { clockInZone } from "@/lib/clock";
import type { ScheduleData } from "@/lib/dashboard";
import { addCalendarDays, addCalendarMonths, dayColumnLabel } from "@/lib/datetime";
import type { ScheduleDay } from "@/lib/day-plan";
import { obligationPhrase } from "@/lib/day-status";
import { subjectGlyph, subjectTone } from "@/lib/subject-color";
import { cn } from "@/lib/utils";

const busyKindLabel: Record<string, string> = {
  class: "Clase",
  exam: "Examen",
  event: "Evento",
  calendar: "Calendar",
  assignment: "Entrega",
  task: "Tarea",
};

const GLYPH: Record<ReturnType<typeof subjectGlyph>, LucideIcon> = {
  calendar: CalendarDays,
  code: Code,
  atom: Atom,
  book: BookOpen,
  database: Database,
  task: ListTodo,
  exam: GraduationCap,
  event: Calendar,
};

function compactRange(label: string) {
  return label.replace(/ – /g, "–");
}

function EventBlock({ block }: { block: CalendarBlock }) {
  const layout = blockLayout(block);
  if (layout.hidden) return null;
  const tone = subjectTone(block.title, block.kind);
  const showMeta = layout.height >= 56;
  const showLocation = layout.height >= 72 && block.location;
  const kind = busyKindLabel[block.kind];
  const Icon = GLYPH[subjectGlyph(block.title, block.kind)];

  return (
    <div
      className={cn(
        "absolute inset-x-1 overflow-hidden rounded-lg border border-l-2 px-1.5 py-1 leading-tight",
        tone.block,
        tone.accent,
      )}
      style={{ top: layout.top, height: layout.height }}
      title={[block.title, compactRange(block.rangeLabel), block.location, kind]
        .filter(Boolean)
        .join(" · ")}
    >
      <div className="flex items-start gap-1">
        {showMeta ? <Icon className="mt-0.5 size-3 shrink-0 opacity-80" /> : null}
        <p className="min-w-0 truncate text-xs font-medium">{block.title}</p>
      </div>
      {showMeta ? (
        <p className="mt-0.5 font-mono text-[11px] tabular-nums opacity-80">
          {compactRange(block.rangeLabel)}
        </p>
      ) : null}
      {showLocation ? <p className="mt-0.5 truncate text-[11px] opacity-75">{block.location}</p> : null}
      {showMeta && block.kind !== "class" && kind ? (
        <p className="mt-0.5 text-[11px] uppercase tracking-wide opacity-70">{kind}</p>
      ) : null}
    </div>
  );
}

function NowLine({ top }: { top: number | null }) {
  if (top == null) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top }}>
      <div className="absolute -left-1.5 -top-1 size-2.5 rounded-full bg-primary" />
      <div className="h-px bg-primary" />
    </div>
  );
}

function DayBody({
  day,
  hours,
  nowTop,
}: {
  day: ScheduleDay;
  hours: number[];
  nowTop: number | null;
}) {
  const blocks = busyBlocksFromDay(day);
  const emptyFree = day.isToday && !dayHasBusy(day) && day.status === "free";
  const emptyDue = day.isToday && !dayHasBusy(day) && day.status === "freeWithDue";
  const dueNote = obligationPhrase(day.obligations);

  return (
    <div
      className={cn("relative min-w-0 border-l border-border/40", day.isToday && "bg-primary/5")}
      style={{ height: hours.length * HOUR_HEIGHT }}
    >
      {hours.map((hour) => (
        <div
          key={`${day.date}-${hour}`}
          className="border-t border-border/30"
          style={{ height: HOUR_HEIGHT }}
        />
      ))}
      {blocks.map((block) => (
        <EventBlock key={`${block.title}-${block.startMin}-${block.kind}`} block={block} />
      ))}
      {day.isToday ? <NowLine top={nowTop} /> : null}
      {emptyFree ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center">
          <Sparkles className="size-5 text-primary/80" />
          <p className="text-xs font-medium leading-snug">Tu día está bastante libre.</p>
          <p className="text-xs leading-snug text-muted-foreground">Un buen momento para adelantar tareas.</p>
        </div>
      ) : null}
      {emptyDue && dueNote ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 text-center">
          <p className="text-xs font-medium leading-snug">Libre de clases</p>
          <p className="text-xs leading-snug text-muted-foreground">Tienes {dueNote}.</p>
        </div>
      ) : null}
    </div>
  );
}

function WeekGrid({
  days,
  timeZone,
  nowTop,
}: {
  days: ScheduleDay[];
  timeZone: string;
  nowTop: number | null;
}) {
  const hours = gridHours();

  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <div className="min-w-[760px] px-1">
        <div className="grid" style={{ gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(5.5rem, 1fr))` }}>
          <div />
          {days.map((day) => {
            const stats = occupancy(day);
            const label = dayColumnLabel(day.date, timeZone);
            return (
              <div
                key={`head-${day.date}`}
                className={cn(
                  "flex flex-col items-center rounded-t-lg px-1 py-2",
                  day.isToday && "bg-primary/10 ring-1 ring-inset ring-primary/40",
                )}
              >
                <p className={cn("text-xs font-medium", day.isToday ? "text-primary" : "text-muted-foreground")}>
                  {label.abbr} {label.day}
                </p>
                {day.isToday ? (
                  <span className="mt-1 size-1.5 rounded-full bg-primary" aria-label="Hoy" />
                ) : (
                  <span className="mt-1 h-1.5" />
                )}
                <div className="mt-1.5 h-1 w-full max-w-14 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${stats.pct}%` }} />
                </div>
              </div>
            );
          })}
          <div className="flex flex-col">
            {hours.map((hour) => (
              <div
                key={hour}
                className="pr-2 text-right font-mono text-[11px] tabular-nums text-muted-foreground"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="-translate-y-2 block">{formatHour(hour)}</span>
              </div>
            ))}
          </div>
          {days.map((day) => (
            <DayBody key={day.date} day={day} hours={hours} nowTop={nowTop} />
          ))}
        </div>
        <AfterHoursRow days={days} />
      </div>
    </div>
  );
}

function AfterHoursRow({ days }: { days: ScheduleDay[] }) {
  const hasAfterHours = days.some((day) => day.obligations.some((item) => item.afterHours));
  if (!hasAfterHours) return null;
  return (
    <div
      className="mt-2 grid border-t border-dashed border-border/60 pt-2"
      style={{ gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(5.5rem, 1fr))` }}
    >
      <p className="pr-2 pt-1 text-right text-[11px] leading-tight text-muted-foreground">
        Fuera del horario
      </p>
      {days.map((day) => {
        const items = day.obligations.filter((item) => item.afterHours);
        return (
          <div key={`after-${day.date}`} className="min-w-0 border-l border-border/40 px-1 py-1">
            {items.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/50">—</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="rounded-md bg-rose-500/10 px-1.5 py-1">
                  <p className="font-mono text-[11px] tabular-nums text-rose-300">{item.timeLabel}</p>
                  <p className="truncate text-xs leading-tight">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.type === "exam" ? "Examen" : item.type === "event" || item.type === "calendar" ? "Evento" : "Entrega"}
                  </p>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

function MonthCell({
  day,
  inMonth,
}: {
  day: ScheduleDay;
  inMonth: boolean;
}) {
  const blocks = busyBlocksFromDay(day);
  const shown = blocks.slice(0, 3);
  const extra = blocks.length - shown.length;
  const afterHours = day.obligations.filter((item) => item.afterHours);
  const dateNum = day.date.slice(8).replace(/^0/, "");

  return (
    <div
      className={cn(
        "flex min-h-[7.5rem] flex-col gap-1 rounded-lg p-1.5 ring-1 ring-border/50",
        day.isToday && "bg-primary/10 ring-primary/40",
        !inMonth && "opacity-40",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex size-6 items-center justify-center text-xs font-medium",
            day.isToday && "rounded-full bg-primary text-primary-foreground",
          )}
        >
          {dateNum}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {shown.map((block) => {
          const tone = subjectTone(block.title, block.kind);
          return (
            <div
              key={`${block.title}-${block.startMin}`}
              className={cn("truncate rounded-md border px-1.5 py-0.5 text-xs leading-tight", tone.block)}
              title={`${block.title} · ${compactRange(block.rangeLabel)}`}
            >
              {block.title}
            </div>
          );
        })}
        {extra > 0 ? <p className="text-xs text-muted-foreground">+{extra} más</p> : null}
        {afterHours.map((item) => (
          <div
            key={item.id}
            className="truncate rounded-md border border-rose-400/30 bg-rose-500/15 px-1.5 py-0.5 text-xs leading-tight text-rose-50"
            title={`${item.title} · ${item.timeLabel}`}
          >
            {item.timeLabel} {item.title}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthGrid({ days, month }: { days: ScheduleDay[]; month: string }) {
  const labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1.5">
        {labels.map((label) => (
          <p key={label} className="px-1 text-xs font-medium text-muted-foreground">
            {label}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => (
          <MonthCell key={day.date} day={day} inMonth={day.date.startsWith(month)} />
        ))}
      </div>
    </div>
  );
}

function Legend({ days }: { days: ScheduleDay[] }) {
  const items = legendFromDays(days);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("size-2 rounded-full", item.tone.swatch)} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

type ViewMode = "week" | "month";

export function WeekSchedule({
  weekDays: initialWeekDays,
  monthDays: initialMonthDays,
  today,
  timeZone,
  weekLabel: initialWeekLabel,
  monthLabel: initialMonthLabel,
  month: initialMonth,
}: {
  weekDays: ScheduleDay[];
  monthDays: ScheduleDay[];
  today: string;
  timeZone: string;
  weekLabel: string;
  monthLabel: string;
  month: string;
}) {
  const [view, setView] = useState<ViewMode>("week");
  const [nav, setNav] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [clock, setClock] = useState(() => clockInZone(timeZone));

  useEffect(() => {
    const id = setInterval(() => setClock(clockInZone(timeZone)), 60_000);
    return () => clearInterval(id);
  }, [timeZone]);

  const weekDays = nav?.weekDays ?? initialWeekDays;
  const monthDays = nav?.monthDays ?? initialMonthDays;
  const weekLabel = nav?.weekLabel ?? initialWeekLabel;
  const monthLabel = nav?.monthLabel ?? initialMonthLabel;
  const month = nav?.month ?? initialMonth;
  const anchor = view === "week" ? (weekDays[0]?.date ?? today) : `${month}-15`;
  const nowTop = nowLineTopFromClock(clock.hour, clock.minute);
  const stats = weekStats(weekDays, today, clock.startMin);

  async function load(date: string) {
    if (date === today) {
      setNav(null);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/schedule?date=${date}`);
      const data = (await response.json()) as ScheduleData & { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "No pude cargar el horario");
        return;
      }
      setNav(data);
    } catch {
      toast.error("Error de red al cargar el horario");
    } finally {
      setLoading(false);
    }
  }

  function goToday() {
    setView("week");
    setNav(null);
  }

  function goPrev() {
    if (view === "week") void load(addCalendarDays(anchor, -7, timeZone));
    else void load(addCalendarMonths(`${month}-15`, -1, timeZone));
  }

  function goNext() {
    if (view === "week") void load(addCalendarDays(anchor, 7, timeZone));
    else void load(addCalendarMonths(`${month}-15`, 1, timeZone));
  }

  const periodLabel = view === "week" ? weekLabel : monthLabel;
  const legendDays = view === "week" ? weekDays : monthDays;
  const paddedWeek = useMemo(() => weekDays.slice(0, 7), [weekDays]);

  if (paddedWeek.length === 0 && monthDays.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-[17px]">Horario</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No hay días en este periodo.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <CardTitle className="flex items-center gap-2 text-[17px]">
            <CalendarDays className="size-4 text-primary" />
            Horario
          </CardTitle>
          <CardDescription>
            {view === "week"
              ? "Clases, tareas y eventos en su hora."
              : "Resumen del mes: clases, tareas y exámenes."}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div className="inline-flex rounded-lg bg-muted p-0.5">
            <button
              type="button"
              aria-pressed={view === "week"}
              onClick={() => setView("week")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                view === "week"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Semana
            </button>
            <button
              type="button"
              aria-pressed={view === "month"}
              onClick={() => setView("month")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                view === "month"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Mes
            </button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={goPrev}
              disabled={loading}
              aria-label={view === "week" ? "Semana anterior" : "Mes anterior"}
            >
              <ChevronLeft />
            </Button>
            <p className="min-w-[6.5rem] text-center text-xs font-medium tabular-nums">{periodLabel}</p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={goNext}
              disabled={loading}
              aria-label={view === "week" ? "Semana siguiente" : "Mes siguiente"}
            >
              <ChevronRight />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={goToday} disabled={loading}>
              Hoy
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("flex flex-col gap-3", loading && "opacity-70")}>
        {view === "week" ? (
          <WeekGrid days={paddedWeek} timeZone={timeZone} nowTop={nowTop} />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <MonthGrid days={monthDays} month={month} />
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Legend days={legendDays} />
          {view === "week" && (stats.classTotal > 0 || stats.freeMin > 0) ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {stats.classTotal > 0 ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-1.5 w-14 overflow-hidden rounded-full bg-muted"
                    aria-hidden
                  >
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.round((stats.classDone / stats.classTotal) * 100)}%` }}
                    />
                  </span>
                  {stats.classDone}/{stats.classTotal} clases
                </span>
              ) : null}
              {stats.freeMin > 0 ? <span>{formatMinutesLabel(stats.freeMin)} libres esta semana</span> : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
