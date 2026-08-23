import { CloudMoon, CloudRain, CloudSun, Sun } from "lucide-react";
import type { TodayInsight, InsightTone } from "@/lib/today-insight";
import type { WeatherNow } from "@/lib/weather";
import { cn } from "@/lib/utils";

const TONE_DOT: Record<InsightTone, string> = {
  calm: "bg-emerald-400",
  watch: "bg-amber-400",
  act: "bg-rose-400",
  occupied: "bg-sky-400",
};

const TONE_TEXT: Record<InsightTone, string> = {
  calm: "text-emerald-300",
  watch: "text-amber-300",
  act: "text-rose-300",
  occupied: "text-sky-300",
};

const TONE_GLOW: Record<InsightTone, string> = {
  calm: "bg-emerald-500/14",
  watch: "bg-amber-500/14",
  act: "bg-rose-500/16",
  occupied: "bg-sky-500/14",
};

const TONE_EDGE: Record<InsightTone, string> = {
  calm: "bg-emerald-400/70",
  watch: "bg-amber-400/70",
  act: "bg-rose-400/70",
  occupied: "bg-sky-400/70",
};

function PeriodIcon({
  part,
  weather,
  className,
}: {
  part: TodayInsight["part"];
  weather: WeatherNow | null;
  className?: string;
}) {
  if (weather?.condition === "rain" || weather?.condition === "storm") {
    return <CloudRain className={className} />;
  }
  if (part.id === "evening") return <CloudMoon className={className} />;
  if (weather?.condition === "clouds") return <CloudSun className={className} />;
  if (part.id === "morning") return <Sun className={className} />;
  return <CloudSun className={className} />;
}

/** Resalta el nombre de la obligación dentro de la frase, sin reescribirla. */
function Headline({ text, highlight }: { text: string; highlight: string | null }) {
  if (!highlight) return <>{text}</>;
  const index = text.indexOf(highlight);
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <span className="text-primary">{highlight}</span>
      {text.slice(index + highlight.length)}
    </>
  );
}

export function TodayHero({
  insight,
  weather,
  support,
}: {
  insight: TodayInsight;
  weather: WeatherNow | null;
  support?: string | null;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card px-5 py-6 md:px-6">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-28 -right-16 size-80 rounded-full blur-3xl",
          TONE_GLOW[insight.tone],
        )}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-10 size-56 rounded-full bg-primary/8 blur-3xl"
      />
      <div
        aria-hidden
        className={cn("absolute inset-y-4 left-0 w-0.5 rounded-full", TONE_EDGE[insight.tone])}
      />
      <div className="relative flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-foreground/8 px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase">
            <PeriodIcon part={insight.part} weather={weather} className="size-3.5 text-primary" />
            {insight.part.label}
            <span className="font-mono text-[10px] font-normal tracking-normal text-muted-foreground">
              {insight.part.rangeLabel.replace(/ – /g, "–")}
            </span>
          </span>
          <span className={cn("inline-flex items-center gap-2 text-xs font-medium", TONE_TEXT[insight.tone])}>
            <span className={cn("size-1.5 rounded-full", TONE_DOT[insight.tone])} aria-hidden />
            {insight.statusLabel}
          </span>
        </div>

        <h2 className="max-w-2xl text-balance text-2xl leading-tight font-semibold tracking-tight md:text-[27px]">
          <Headline text={insight.headline} highlight={insight.subject?.title ?? null} />
        </h2>

        {support ? (
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{support}</p>
        ) : null}
      </div>
    </section>
  );
}
