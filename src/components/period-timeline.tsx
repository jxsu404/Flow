import type { ScheduleSegment } from "@/lib/day-plan";
import { subjectTone } from "@/lib/subject-color";
import { cn } from "@/lib/utils";

const TICK_STEP_MIN = 120;

function hhmm(minFromAwake: number): string {
  const total = minFromAwake + 7 * 60;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function box(
  segment: ScheduleSegment,
  windowStartMin: number,
  windowSpanMin: number,
): { left: number; width: number } | null {
  const start = Math.max(segment.startMin, windowStartMin);
  const end = Math.min(segment.startMin + segment.durationMin, windowStartMin + windowSpanMin);
  if (end <= start) return null;
  return {
    left: ((start - windowStartMin) / windowSpanMin) * 100,
    width: ((end - start) / windowSpanMin) * 100,
  };
}

/** Solo el periodo actual: una franja de tiempo legible, no la agenda completa. */
export function PeriodTimeline({
  label,
  segments,
  windowStartMin,
  windowSpanMin,
  nowMin,
}: {
  label: string;
  segments: ScheduleSegment[];
  windowStartMin: number;
  windowSpanMin: number;
  nowMin: number | null;
}) {
  const ticks: number[] = [];
  for (let min = windowStartMin; min <= windowStartMin + windowSpanMin; min += TICK_STEP_MIN) {
    ticks.push(min);
  }
  const nowLeft =
    nowMin != null && nowMin >= windowStartMin && nowMin <= windowStartMin + windowSpanMin
      ? ((nowMin - windowStartMin) / windowSpanMin) * 100
      : null;
  const legend = new Map<string, { label: string; swatch: string }>();
  for (const segment of segments) {
    if (segment.type === "free") {
      legend.set("free", { label: "Libre", swatch: "bg-primary/35" });
      continue;
    }
    const tone = subjectTone(segment.title, segment.kind);
    legend.set(tone.key, { label: tone.label ?? "Clase", swatch: tone.swatch });
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-card px-4 py-4 md:px-5">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        Tu {label.toLowerCase()}
      </p>

      <div className="relative mt-3 h-4">
        {ticks.map((tick, index) => {
          if (nowMin != null && Math.abs(tick - nowMin) < 40) return null;
          return (
            <span
              key={tick}
              className="absolute top-0 font-mono text-[11px] tabular-nums text-muted-foreground"
              style={{
                left: `${((tick - windowStartMin) / windowSpanMin) * 100}%`,
                transform:
                  index === 0
                    ? undefined
                    : index === ticks.length - 1
                      ? "translateX(-100%)"
                      : "translateX(-50%)",
              }}
            >
              {hhmm(tick)}
            </span>
          );
        })}
        {nowLeft != null ? (
          <span
            className="absolute top-0 rounded bg-primary/15 px-1.5 font-mono text-[11px] tabular-nums text-primary"
            style={{
              left: `${nowLeft}%`,
              transform: nowLeft > 92 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {hhmm(nowMin!)}
          </span>
        ) : null}
      </div>

      <div className="relative mt-1 h-14">
        {segments.map((segment) => {
          const position = box(segment, windowStartMin, windowSpanMin);
          if (!position) return null;
          const tone = segment.type === "busy" ? subjectTone(segment.title, segment.kind) : null;
          return (
            <div
              key={`${segment.type}-${segment.startMin}-${segment.title}`}
              className={cn(
                "absolute top-0 flex h-full min-w-0 flex-col justify-center overflow-hidden rounded-lg border px-2",
                segment.type === "free"
                  ? "border-dashed border-foreground/15 bg-foreground/[0.04]"
                  : tone?.block,
              )}
              style={{ left: `${position.left}%`, width: `calc(${position.width}% - 3px)` }}
              title={`${segment.title} · ${segment.rangeLabel}`}
            >
              <p className="truncate text-xs font-medium">{segment.title}</p>
              <p className="truncate font-mono text-[10px] tabular-nums opacity-70">
                {segment.rangeLabel.replace(/ – /g, "–")}
              </p>
            </div>
          );
        })}
        {nowLeft != null ? (
          <div
            className="pointer-events-none absolute inset-y-0 z-10 w-0.5 rounded-full bg-primary"
            style={{ left: `${nowLeft}%` }}
            aria-hidden
          />
        ) : null}
      </div>

      {legend.size > 0 ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {[...legend.entries()].map(([key, entry]) => (
            <span key={key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", entry.swatch)} aria-hidden />
              {entry.label}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
