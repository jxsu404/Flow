import { formatInTimeZone } from "date-fns-tz";
import { Badge } from "@/components/ui/badge";
import type { Item } from "@/db/schema";
import {
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
  later: "border-transparent bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
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
  const when = item.dueAt
    ? formatInTimeZone(item.dueAt, timeZone, "EEE d MMM HH:mm")
    : "Sin fecha";

  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-3 last:border-0">
      <div>
        <p className="font-medium leading-tight">{item.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {dueCaption(item, urgency)}
          <span className="text-muted-foreground/70"> · {when}</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        <Badge variant="secondary">{KIND_LABEL[kind]}</Badge>
        {urgency ? (
          <Badge className={cn(urgencyClass[urgency.level])}>{urgency.label}</Badge>
        ) : null}
      </div>
    </div>
  );
}
