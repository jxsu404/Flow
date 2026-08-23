"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  interpretToday,
  type InsightBusy,
  type InsightItem,
  type InsightTone,
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
  const [now, setNow] = useState(() => nowProp ?? new Date());

  useEffect(() => {
    if (nowProp) {
      setNow(nowProp);
      return;
    }
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [nowProp]);

  const insight = interpretToday({ now, timeZone, items, busy });

  return (
    <div className="flex items-start gap-3">
      <span
        className={cn("mt-2 size-2.5 shrink-0 rounded-full", TONE_DOT[insight.tone])}
        aria-hidden
      />
      <div className="min-w-0">
        <p className={cn("text-lg font-semibold leading-snug", TONE_HEADLINE[insight.tone])}>
          {insight.headline}
        </p>
        {insight.subject ? (
          <div className="mt-3">
            <p className="text-sm font-medium leading-snug">{insight.subject.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{insight.subject.meta}</p>
          </div>
        ) : null}
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{insight.detail}</p>
        {insight.subject ? (
          <Button variant="ghost" size="sm" className="mt-3 h-8 px-0 text-primary" asChild>
            <Link href={insight.subject.href}>
              {insight.subject.cta}
              <ChevronRight />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
