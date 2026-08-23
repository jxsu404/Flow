export type SubjectTone = {
  key: string;
  label?: string;
  block: string;
  swatch: string;
};

const SUBJECT_TONES: SubjectTone[] = [
  { key: "teal", block: "border-teal-400/25 bg-teal-500/18 text-teal-50", swatch: "bg-teal-400" },
  { key: "violet", block: "border-violet-400/25 bg-violet-500/18 text-violet-50", swatch: "bg-violet-400" },
  { key: "orange", block: "border-orange-400/25 bg-orange-500/18 text-orange-50", swatch: "bg-orange-400" },
  { key: "emerald", block: "border-emerald-400/25 bg-emerald-500/18 text-emerald-50", swatch: "bg-emerald-400" },
  { key: "sky", block: "border-sky-400/25 bg-sky-500/18 text-sky-50", swatch: "bg-sky-400" },
  { key: "fuchsia", block: "border-fuchsia-400/25 bg-fuchsia-500/18 text-fuchsia-50", swatch: "bg-fuchsia-400" },
  { key: "amber", block: "border-amber-400/25 bg-amber-500/18 text-amber-50", swatch: "bg-amber-400" },
  { key: "cyan", block: "border-cyan-400/25 bg-cyan-500/18 text-cyan-50", swatch: "bg-cyan-400" },
];

const KIND_TONES: Record<string, SubjectTone> = {
  task: { key: "task", label: "Tareas", block: "border-rose-400/30 bg-rose-500/18 text-rose-50", swatch: "bg-rose-400" },
  assignment: {
    key: "task",
    label: "Tareas",
    block: "border-rose-400/30 bg-rose-500/18 text-rose-50",
    swatch: "bg-rose-400",
  },
  exam: {
    key: "exam",
    label: "Exámenes",
    block: "border-orange-400/35 bg-orange-600/20 text-orange-50",
    swatch: "bg-orange-400",
  },
  event: {
    key: "event",
    label: "Eventos",
    block: "border-slate-400/25 bg-slate-500/20 text-slate-50",
    swatch: "bg-slate-400",
  },
  calendar: {
    key: "event",
    label: "Calendar",
    block: "border-slate-400/25 bg-slate-500/20 text-slate-50",
    swatch: "bg-slate-400",
  },
};

export function normalizeSubjectName(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function subjectTone(title: string, kind?: string): SubjectTone {
  if (kind && KIND_TONES[kind]) return KIND_TONES[kind];
  const name = normalizeSubjectName(title);
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return SUBJECT_TONES[hash % SUBJECT_TONES.length] ?? SUBJECT_TONES[0]!;
}
