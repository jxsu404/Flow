export type SubjectGlyph = "calendar" | "code" | "atom" | "book" | "database" | "task" | "exam" | "event";

export type SubjectTone = {
  key: string;
  label?: string;
  block: string;
  swatch: string;
  bar: string;
  accent: string;
};

const SUBJECT_TONES: SubjectTone[] = [
  {
    key: "teal",
    block: "border-teal-400/30 bg-teal-500/18 text-teal-50",
    swatch: "bg-teal-400",
    bar: "bg-teal-400/80",
    accent: "border-l-teal-400",
  },
  {
    key: "violet",
    block: "border-violet-400/30 bg-violet-500/18 text-violet-50",
    swatch: "bg-violet-400",
    bar: "bg-violet-400/80",
    accent: "border-l-violet-400",
  },
  {
    key: "orange",
    block: "border-orange-400/30 bg-orange-500/18 text-orange-50",
    swatch: "bg-orange-400",
    bar: "bg-orange-400/80",
    accent: "border-l-orange-400",
  },
  {
    key: "emerald",
    block: "border-emerald-400/30 bg-emerald-500/18 text-emerald-50",
    swatch: "bg-emerald-400",
    bar: "bg-emerald-400/80",
    accent: "border-l-emerald-400",
  },
  {
    key: "sky",
    block: "border-sky-400/30 bg-sky-500/18 text-sky-50",
    swatch: "bg-sky-400",
    bar: "bg-sky-400/80",
    accent: "border-l-sky-400",
  },
  {
    key: "fuchsia",
    block: "border-fuchsia-400/30 bg-fuchsia-500/18 text-fuchsia-50",
    swatch: "bg-fuchsia-400",
    bar: "bg-fuchsia-400/80",
    accent: "border-l-fuchsia-400",
  },
  {
    key: "amber",
    block: "border-amber-400/30 bg-amber-500/18 text-amber-50",
    swatch: "bg-amber-400",
    bar: "bg-amber-400/80",
    accent: "border-l-amber-400",
  },
  {
    key: "cyan",
    block: "border-cyan-400/30 bg-cyan-500/18 text-cyan-50",
    swatch: "bg-cyan-400",
    bar: "bg-cyan-400/80",
    accent: "border-l-cyan-400",
  },
];

const TONE_BY_KEY = new Map(SUBJECT_TONES.map((tone) => [tone.key, tone]));

const KIND_TONES: Record<string, SubjectTone> = {
  task: {
    key: "task",
    label: "Tareas",
    block: "border-sky-400/35 bg-sky-500/18 text-sky-50",
    swatch: "bg-sky-400",
    bar: "bg-sky-400/80",
    accent: "border-l-sky-400",
  },
  assignment: {
    key: "task",
    label: "Tareas",
    block: "border-sky-400/35 bg-sky-500/18 text-sky-50",
    swatch: "bg-sky-400",
    bar: "bg-sky-400/80",
    accent: "border-l-sky-400",
  },
  exam: {
    key: "exam",
    label: "Exámenes",
    block: "border-orange-400/35 bg-orange-600/20 text-orange-50",
    swatch: "bg-orange-400",
    bar: "bg-orange-400/85",
    accent: "border-l-orange-400",
  },
  event: {
    key: "event",
    label: "Eventos",
    block: "border-slate-400/25 bg-slate-500/20 text-slate-50",
    swatch: "bg-slate-400",
    bar: "bg-slate-400/80",
    accent: "border-l-slate-400",
  },
  calendar: {
    key: "event",
    label: "Calendar",
    block: "border-slate-400/25 bg-slate-500/20 text-slate-50",
    swatch: "bg-slate-400",
    bar: "bg-slate-400/80",
    accent: "border-l-slate-400",
  },
};

const NAMED_SUBJECTS: Array<{ re: RegExp; key: string; glyph: SubjectGlyph }> = [
  { re: /matematic/, key: "teal", glyph: "calendar" },
  { re: /programacion|codigo|software|computacion/, key: "violet", glyph: "code" },
  { re: /fisic/, key: "orange", glyph: "atom" },
  { re: /base de datos|\bbd\b|\bsql\b/, key: "emerald", glyph: "database" },
  { re: /ingles|english/, key: "sky", glyph: "book" },
];

export function normalizeSubjectName(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function fold(value: string): string {
  return normalizeSubjectName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function namedSubject(title: string) {
  const text = fold(title);
  return NAMED_SUBJECTS.find((entry) => entry.re.test(text)) ?? null;
}

function hashTone(title: string): SubjectTone {
  const name = normalizeSubjectName(title);
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return SUBJECT_TONES[hash % SUBJECT_TONES.length] ?? SUBJECT_TONES[0]!;
}

export function subjectTone(title: string, kind?: string): SubjectTone {
  if (kind && KIND_TONES[kind]) return KIND_TONES[kind];
  const named = namedSubject(title);
  if (named) return TONE_BY_KEY.get(named.key) ?? hashTone(title);
  return hashTone(title);
}

export function subjectGlyph(title: string, kind?: string): SubjectGlyph {
  if (kind === "task" || kind === "assignment") return "task";
  if (kind === "exam") return "exam";
  if (kind === "event" || kind === "calendar") return "event";
  return namedSubject(title)?.glyph ?? "calendar";
}
