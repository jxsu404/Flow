import { formatInTimeZone } from "date-fns-tz";
import { Badge } from "@/components/ui/badge";
import type { Item } from "@/db/schema";
import {
  KIND_BADGE_CLASS,
  KIND_LABEL,
  activityKind,
  dueCaption,
  urgencyForDue,
  type UrgencyLevel,
} from "@/lib/deadlines";
import { cn } from "@/lib/utils";

const urgencyClass: Record<UrgencyLevel, string> = {
  urgent: "border-transparent bg-red-500/15 text-red-700 dark:text-red-400",
  soon: "border-transparent bg-orange-500/15 text-orange-800 dark:text-orange-300",
  later: "border-transparent bg-muted text-muted-foreground",
};

export function DeadlineRow({
  item,
  today,
  timeZone,
}: {
  item: Item;
  today: string;
  timeZone: string;
}) {
  const kind = activityKind(item);
  const urgency = urgencyForDue(item.dueAt, today, timeZone);
  const clock = item.dueAt
    ? formatInTimeZone(
        item.dueAt,
        timeZone,
        urgency && urgency.daysLeft <= 1 ? "HH:mm" : "EEE d MMM · HH:mm",
      )
    : null;
  const caption = dueCaption(item, urgency);
  const when = clock ? `${caption} · ${clock}` : caption;
  const kindClass = KIND_BADGE_CLASS[kind];

  return (
    <div className="border-b border-border/50 py-2.5 last:border-0">
      <p className="text-sm font-medium leading-snug">{item.title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{when}</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Badge variant="secondary" className={cn("h-5 tracking-wide", kindClass || undefined)}>
          {KIND_LABEL[kind]}
        </Badge>
        {urgency ? (
          <Badge className={cn("h-5 tracking-wide", urgencyClass[urgency.level])}>
            {urgency.label}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
