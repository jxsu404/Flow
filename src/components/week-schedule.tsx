"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScheduleDay, SchedulePart, ScheduleSegment } from "@/lib/day-plan";
import { cn } from "@/lib/utils";

const busyKindLabel: Record<string, string> = {
  class: "Clase",
  exam: "Examen",
  event: "Evento",
  calendar: "Calendar",
  assignment: "Entrega",
  task: "Tarea",
};

const AWAKE_MINUTES = 15 * 60;

function TimelineBar({ segments }: { segments: ScheduleSegment[] }) {
  const filled = segments.map((segment) => ({
    ...segment,
    left: Math.max(0, (segment.startMin / AWAKE_MINUTES) * 100),
    width: Math.max(1.2, (segment.durationMin / AWAKE_MINUTES) * 100),
  }));

  return (
    <div className="relative h-8 overflow-hidden rounded-md bg-muted/60 ring-1 ring-foreground/10">
      {filled.map((segment) => (
        <div
          key={`${segment.type}-${segment.rangeLabel}`}
          title={`${segment.title} ${segment.rangeLabel}`}
          className={cn(
            "absolute top-0 h-full",
            segment.type === "busy" ? "bg-foreground/80" : "bg-primary/25",
          )}
          style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
        />
      ))}
    </div>
  );
}

function PartAccordion({ part, defaultOpen }: { part: SchedulePart; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const freeCount = part.segments.filter((s) => s.type === "free").length;
  const busyCount = part.segments.length - freeCount;
  const summary = [
    busyCount ? `${busyCount} ocupado${busyCount === 1 ? "" : "s"}` : null,
    freeCount ? `${freeCount} libre${freeCount === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-lg ring-1 ring-foreground/10">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {part.part}
            </p>
            <p className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
              {part.rangeLabel}
            </p>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{summary || "Sin bloques"}</p>
        </div>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div className="flex flex-col gap-2 border-t border-border/50 px-3 py-3">
          <TimelineBar segments={part.segments} />
          {part.segments.map((segment) => (
            <div
              key={`${segment.type}-${segment.rangeLabel}`}
              className={cn(
                "rounded-lg px-3 py-2",
                segment.type === "free"
                  ? "border border-dashed border-border bg-muted/30"
                  : "bg-secondary",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium leading-tight">{segment.title}</p>
                <p className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {segment.rangeLabel}
                </p>
              </div>
              {segment.type === "busy" && segment.kind ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {busyKindLabel[segment.kind] ?? segment.kind}
                </p>
              ) : null}
              {segment.suggestionTitle ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Puedes avanzar {segment.suggestionTitle}
                  {segment.suggestionDue ? ` · ${segment.suggestionDue}` : ""}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function WeekSchedule({ days }: { days: ScheduleDay[] }) {
  const today = days.find((day) => day.isToday) ?? days[0];
  const [selected, setSelected] = useState(today?.date ?? days[0]?.date ?? "");
  const day = days.find((item) => item.date === selected) ?? today;

  if (!day) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Horario</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No hay días en esta semana.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Horario</CardTitle>
        <CardDescription>
          Elige un día. Mañana, tarde y noche se despliegan. La barra es tu línea de tiempo (07:00–22:00).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-7 gap-1">
          {days.map((item) => (
            <button
              key={item.date}
              type="button"
              onClick={() => setSelected(item.date)}
              className={cn(
                "flex flex-col items-center rounded-lg px-1 py-2 text-center transition-colors",
                item.date === selected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="text-[11px] font-medium">{item.weekday.slice(0, 3)}</span>
              {item.isToday ? (
                <Badge
                  variant="secondary"
                  className={cn(
                    "mt-1 h-4 px-1 text-[9px]",
                    item.date === selected && "bg-primary-foreground/20 text-primary-foreground",
                  )}
                >
                  Hoy
                </Badge>
              ) : (
                <span className="mt-1 h-4 text-[9px] opacity-70">{item.date.slice(8)}</span>
              )}
            </button>
          ))}
        </div>

        <div>
          <p className="font-medium">{day.heading}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{day.summary}</p>
        </div>

        <TimelineBar segments={day.parts.flatMap((part) => part.segments)} />

        <div className="flex flex-col gap-2">
          {day.parts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin bloques en el horario despierto.</p>
          ) : (
            day.parts.map((part, index) => (
              <PartAccordion
                key={`${day.date}-${part.part}`}
                part={part}
                defaultOpen={day.isToday ? index === 0 : false}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
