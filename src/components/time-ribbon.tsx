import type { ScheduleSegment } from "@/lib/day-plan";
import { GRID_SPAN_MIN, GRID_START_MIN } from "@/lib/calendar-grid";
import { subjectTone } from "@/lib/subject-color";
import { cn } from "@/lib/utils";

const TICKS = [8, 12, 16, 20, 22];

function clip(startMin: number, durationMin: number): { left: number; width: number } | null {
  const start = Math.max(startMin, GRID_START_MIN);
  const end = Math.min(startMin + durationMin, GRID_START_MIN + GRID_SPAN_MIN);
  if (end <= start) return null;
  return {
    left: ((start - GRID_START_MIN) / GRID_SPAN_MIN) * 100,
    width: ((end - start) / GRID_SPAN_MIN) * 100,
  };
}

function nowMarkerLeft(nowStartMin: number): number | null {
  if (nowStartMin < GRID_START_MIN || nowStartMin > GRID_START_MIN + GRID_SPAN_MIN) return null;
  return ((nowStartMin - GRID_START_MIN) / GRID_SPAN_MIN) * 100;
}

export function TimeRibbon({
  segments,
  nowStartMin,
  className,
}: {
  segments: ScheduleSegment[];
  nowStartMin?: number | null;
  className?: string;
}) {
  const nowLeft = nowStartMin == null ? null : nowMarkerLeft(nowStartMin);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
        {segments.map((segment) => {
          const box = clip(segment.startMin, segment.durationMin);
          if (!box) return null;
          const tone = segment.type === "busy" ? subjectTone(segment.title, segment.kind) : null;
          return (
            <div
              key={`${segment.type}-${segment.rangeLabel}-${segment.title}`}
              className={cn("absolute top-0 h-full rounded-full", segment.type === "free" ? "bg-primary/25" : tone?.bar)}
              style={{ left: `${box.left}%`, width: `${Math.max(box.width, 0.8)}%` }}
              title={`${segment.title} · ${segment.rangeLabel}`}
            />
          );
        })}
        {nowLeft != null && nowLeft >= 0 && nowLeft <= 100 ? (
          <div
            className="absolute top-0 z-10 h-full w-0.5 bg-primary"
            style={{ left: `${nowLeft}%` }}
            aria-hidden
          />
        ) : null}
      </div>
      <div className="flex justify-between font-mono text-[11px] tabular-nums text-muted-foreground">
        {TICKS.map((hour) => (
          <span key={hour}>{String(hour).padStart(2, "0")}:00</span>
        ))}
      </div>
    </div>
  );
}

export function OccupancyRing({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative size-12 shrink-0 rounded-full"
        style={{ background: `conic-gradient(var(--primary) ${pct}%, var(--muted) 0)` }}
        aria-label={label}
      >
        <div className="absolute inset-1 flex items-center justify-center rounded-full bg-card">
          <span className="text-xs font-medium tabular-nums">{pct}%</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
