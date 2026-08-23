"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HOUR_HEIGHT,
  blockLayout,
  busyBlocksFromDay,
  dayHasBusy,
  formatHour,
  gridHours,
  legendFromDays,
  occupancy,
  type CalendarBlock,
} from "@/lib/calendar-grid";
import type { ScheduleData } from "@/lib/dashboard";
import { addCalendarDays, addCalendarMonths, dayColumnLabel } from "@/lib/datetime";
import type { ScheduleDay } from "@/lib/day-plan";
import { subjectTone } from "@/lib/subject-color";
import { cn } from "@/lib/utils";

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

function EventBlock({ block }: { block: CalendarBlock }) {
  const layout = blockLayout(block);
  if (layout.hidden) return null;
  const tone = subjectTone(block.title, block.kind);
  const showMeta = layout.height >= 56;
  const showLocation = layout.height >= 72 && block.location;
  const kind = busyKindLabel[block.kind];

  return (
    <div
      className={cn(
        "absolute inset-x-1 overflow-hidden rounded-lg border px-1.5 py-1 leading-tight",
        tone.block,
        block.kind !== "class" && "ring-1 ring-inset ring-white/10",
      )}
      style={{ top: layout.top, height: layout.height }}
      title={[block.title, compactRange(block.rangeLabel), block.location, kind]
        .filter(Boolean)
        .join(" · ")}
    >
      <p className="truncate text-xs font-medium">{block.title}</p>
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

function DayBody({ day, hours }: { day: ScheduleDay; hours: number[] }) {
  const blocks = busyBlocksFromDay(day);
  const emptyToday = day.isToday && !dayHasBusy(day);

  return (
    <div
      className={cn("relative min-w-0 border-l border-border/40", day.isToday && "bg-primary/4")}
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
      {emptyToday ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center">
          <Sparkles className="size-5 text-primary/80" />
          <p className="text-xs leading-snug text-muted-foreground">Tu día está bastante libre.</p>
        </div>
      ) : null}
    </div>
  );
}

function WeekGrid({ days, timeZone }: { days: ScheduleDay[]; timeZone: string }) {
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
                  day.isToday && "bg-primary/8 ring-1 ring-inset ring-primary/35",
                )}
              >
                <p className={cn("text-xs font-medium", day.isToday ? "text-primary" : "text-muted-foreground")}>
                  {label.abbr} {label.day}
                </p>
                {day.isToday ? (
                  <Badge variant="secondary" className="mt-1 h-5 bg-primary/15 px-1.5 text-[10px] text-primary">
                    Hoy
                  </Badge>
                ) : (
                  <span className="mt-1 h-5" />
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
            <DayBody key={day.date} day={day} hours={hours} />
          ))}
        </div>
      </div>
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
  const dateNum = day.date.slice(8).replace(/^0/, "");

  return (
    <div
      className={cn(
        "flex min-h-[7.5rem] flex-col gap-1 rounded-lg p-1.5 ring-1 ring-border/50",
        day.isToday && "bg-primary/8 ring-primary/40",
        !inMonth && "opacity-40",
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-medium", day.isToday && "text-primary")}>{dateNum}</span>
        {day.isToday ? <span className="text-[10px] font-medium text-primary">Hoy</span> : null}
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
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1">
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

  const weekDays = nav?.weekDays ?? initialWeekDays;
  const monthDays = nav?.monthDays ?? initialMonthDays;
  const weekLabel = nav?.weekLabel ?? initialWeekLabel;
  const monthLabel = nav?.monthLabel ?? initialMonthLabel;
  const month = nav?.month ?? initialMonth;
  const anchor = view === "week" ? (weekDays[0]?.date ?? today) : `${month}-15`;

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
            <CalendarDays className="size-4 text-muted-foreground" />
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
          <WeekGrid days={paddedWeek} timeZone={timeZone} />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <MonthGrid days={monthDays} month={month} />
            </div>
          </div>
        )}
        <Legend days={legendDays} />
      </CardContent>
    </Card>
  );
}
