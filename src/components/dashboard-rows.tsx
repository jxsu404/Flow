import { formatInTimeZone } from "date-fns-tz";
import { Atom, BookOpen, CalendarDays, Code2, Database, FileText, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Item } from "@/db/schema";
import { activityKind, dueCaption, urgencyForDue, type Urgency } from "@/lib/deadlines";
import { subjectGlyph, subjectTone, type SubjectGlyph } from "@/lib/subject-color";
import { cn } from "@/lib/utils";

const GLYPHS: Record<SubjectGlyph, typeof FileText> = {
  calendar: CalendarDays,
  code: Code2,
  atom: Atom,
  book: BookOpen,
  database: Database,
  task: FileText,
  exam: GraduationCap,
  event: CalendarDays,
};

function urgencyBadgeClass(urgency: Urgency): string {
  if (urgency.daysLeft < 0) return "border-transparent bg-rose-500/18 text-rose-300";
  if (urgency.daysLeft === 0) return "border-rose-400/50 bg-transparent text-rose-300";
  if (urgency.level === "soon") return "border-transparent bg-amber-500/15 text-amber-300";
  return "border-transparent bg-foreground/8 text-muted-foreground";
}

export function SubjectGlyphBox({
  title,
  kind,
  className,
}: {
  title: string;
  kind?: string;
  className?: string;
}) {
  const tone = subjectTone(title, kind);
  const Glyph = GLYPHS[subjectGlyph(title, kind)];
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg border",
        tone.block,
        className,
      )}
      aria-hidden
    >
      <Glyph className="size-4" />
    </span>
  );
}

export function ItemRow({
  item,
  today,
  timeZone,
  showTime = true,
}: {
  item: Item;
  today: string;
  timeZone: string;
  showTime?: boolean;
}) {
  const urgency = urgencyForDue(item.dueAt, today, timeZone);
  const clock = item.dueAt && showTime ? formatInTimeZone(item.dueAt, timeZone, "HH:mm") : null;
  const start = item.startAt ? formatInTimeZone(item.startAt, timeZone, "HH:mm") : null;
  const caption = item.dueAt
    ? dueCaption(item, urgency)
    : item.type === "event"
      ? "Evento"
      : "Sin fecha";
  const meta = clock ? `${caption} · ${clock}` : start ? `${caption} · ${start}` : caption;

  return (
    <div className="flex items-center gap-3 border-b border-border/40 py-2.5 last:border-0">
      <SubjectGlyphBox title={item.title} kind={activityKind(item) === "examen" ? "exam" : item.type} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-snug">{item.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
      </div>
      {urgency ? (
        <Badge className={cn("h-5 shrink-0 tracking-wide", urgencyBadgeClass(urgency))}>
          {urgency.label}
        </Badge>
      ) : null}
    </div>
  );
}
