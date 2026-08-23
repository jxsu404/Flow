"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, CloudSun, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  interpretToday,
  type InsightBusy,
  type InsightItem,
  type InsightTone,
  type TodayPart,
} from "@/lib/today-insight";
import { cn } from "@/lib/utils";

const TONE_DOT: Record<InsightTone, string> = {
  calm: "bg-emerald-400",
  watch: "bg-amber-400",
  act: "bg-rose-400",
  occupied: "bg-sky-400",
};

const TONE_HEADLINE: Record<InsightTone, string> = {
  calm: "text-emerald-200",
  watch: "text-amber-200",
  act: "text-rose-300",
  occupied: "text-sky-200",
};

function PartIcon({ part }: { part: TodayPart }) {
  const className = "size-4 text-primary";
  if (part.id === "morning") return <Sun className={className} />;
  if (part.id === "afternoon") return <CloudSun className={className} />;
  return <Moon className={className} />;
}

export function TodayPanel({
  timeZone,
  items,
  busy,
  now: nowProp,
}: {
  timeZone: string;
  items: InsightItem[];
  busy: InsightBusy[];
  now?: Date;
}) {
  const [tick, setTick] = useState(() => new Date());
  const now = nowProp ?? tick;

  useEffect(() => {
    if (nowProp) return;
    const id = setInterval(() => setTick(new Date()), 60_000);
    return () => clearInterval(id);
  }, [nowProp]);

  const insight = interpretToday({ now, timeZone, items, busy });

  return (
    <div className="rounded-xl bg-secondary/50 px-3 py-3 ring-1 ring-foreground/8">
      <div className="flex items-center gap-1.5">
        <PartIcon part={insight.part} />
        <p className="text-xs font-medium tracking-wide text-foreground uppercase">{insight.part.label}</p>
        <span className={cn("size-2 rounded-full", TONE_DOT[insight.tone])} aria-hidden />
      </div>
      <p className="mt-1.5 font-mono text-xs tabular-nums text-muted-foreground">{insight.part.rangeLabel}</p>
      <p className={cn("mt-3 text-[15px] font-semibold leading-snug", TONE_HEADLINE[insight.tone])}>
        {insight.headline}
      </p>
      {insight.subject ? (
        <div className="mt-3">
          <p className="text-sm font-medium leading-snug">{insight.subject.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{insight.subject.meta}</p>
        </div>
      ) : null}
      {insight.detail ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{insight.detail}</p>
      ) : null}
      {insight.subject ? (
        <Button variant="ghost" size="sm" className="mt-3 h-8 px-0 text-primary" asChild>
          <Link href={insight.subject.href}>
            {insight.subject.cta}
            <ChevronRight />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
