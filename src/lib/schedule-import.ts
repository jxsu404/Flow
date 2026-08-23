export const IMPORT_MAX_BYTES = 4 * 1024 * 1024;

export const IMPORT_ACCEPT = ".png,.jpg,.jpeg,.webp,.pdf";

export const IMPORT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
] as const;

export const IMPORT_FORMAT_HINT = "PNG, JPG, WEBP o PDF · máximo 4 MB";

export type DuplicateAction = "keep" | "replace" | "create";

export type UncertainField =
  | "title"
  | "days"
  | "startTime"
  | "endTime"
  | "professor"
  | "location"
  | "section"
  | "courseCode";

export type ExistingClass = {
  id: string;
  title: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type ScheduleDraft = {
  id: string;
  title: string;
  days: number[];
  startTime: string;
  endTime: string;
  professor: string;
  location: string;
  section: string;
  courseCode: string;
  extra: string;
  uncertain: Partial<Record<UncertainField, boolean>>;
  issues: string[];
  duplicateAction: DuplicateAction;
};

export type ParseDocumentResult = {
  documentWarning: string | null;
  classes: ScheduleDraft[];
};

export function isAllowedImportFile(file: { name: string; type: string; size: number }): {
  ok: true;
} | { ok: false; error: string } {
  if (file.size > IMPORT_MAX_BYTES) {
    return { ok: false, error: "El archivo pesa más de 4 MB. Prueba con una imagen más liviana o un PDF más corto." };
  }
  const name = file.name.toLowerCase();
  const extOk = /\.(png|jpe?g|webp|pdf)$/.test(name);
  const mimeOk =
    IMPORT_MIME_TYPES.includes(file.type as (typeof IMPORT_MIME_TYPES)[number]) ||
    (!file.type && extOk);
  if (!extOk && !mimeOk) {
    return {
      ok: false,
      error: `Ese formato no es compatible. Sube un ${IMPORT_FORMAT_HINT}.`,
    };
  }
  return { ok: true };
}

export function mimeFromFile(file: { name: string; type: string }): string {
  if (file.type === "image/jpg") return "image/jpeg";
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".pdf")) return "application/pdf";
  return "image/jpeg";
}

export function normalizeTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!raw) return null;
  const isPm = /\bp\.?\s*m\.?\b/.test(raw) || /\bpm\b/.test(raw);
  const isAm = /\ba\.?\s*m\.?\b/.test(raw) || /\bam\b/.test(raw);
  const match = raw.match(/(\d{1,2})(?:[:h\.](\d{2}))?/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) return null;
  if (isPm && hours < 12) hours += 12;
  if (isAm && hours === 12) hours = 0;
  if (hours > 23) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function normalizeTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function titlesMatch(a: string, b: string): boolean {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  if (!left || !right) return false;
  return left === right;
}

export function composeClassTitle(draft: Pick<ScheduleDraft, "title" | "courseCode">): string {
  const title = draft.title.trim();
  const code = draft.courseCode.trim();
  if (code && title && !title.toLowerCase().includes(code.toLowerCase())) {
    return `${code} ${title}`;
  }
  return title || code;
}

export function composeClassLocation(
  draft: Pick<ScheduleDraft, "location" | "section" | "professor" | "extra">,
): string | null {
  const parts = [
    draft.location.trim(),
    draft.section.trim() ? `Grupo ${draft.section.trim()}` : "",
    draft.professor.trim() ? `Prof. ${draft.professor.trim()}` : "",
    draft.extra.trim(),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function emptyDraft(partial?: Partial<ScheduleDraft>): ScheduleDraft {
  return {
    id: partial?.id ?? crypto.randomUUID(),
    title: "",
    days: [],
    startTime: "",
    endTime: "",
    professor: "",
    location: "",
    section: "",
    courseCode: "",
    extra: "",
    uncertain: {},
    issues: [],
    duplicateAction: "create",
    ...partial,
  };
}

export function rowNeedsReview(draft: ScheduleDraft): boolean {
  return rowBlockers(draft).length > 0 || Object.values(draft.uncertain).some(Boolean);
}

export function rowBlockers(draft: ScheduleDraft): string[] {
  const blockers: string[] = [];
  if (!draft.title.trim()) blockers.push("Nombre de materia");
  if (draft.days.length === 0) blockers.push("Día");
  if (!draft.startTime || !draft.endTime) blockers.push("Horario");
  else if (draft.startTime >= draft.endTime) blockers.push("Horario");
  return blockers;
}

export function matchDuplicates(draft: ScheduleDraft, existing: ExistingClass[]): ExistingClass[] {
  const composed = composeClassTitle(draft);
  const raw = draft.title.trim();
  if ((!composed && !raw) || !draft.startTime || !draft.endTime || draft.days.length === 0) return [];
  return existing.filter(
    (block) =>
      draft.days.includes(block.dayOfWeek) &&
      (titlesMatch(composed, block.title) || titlesMatch(raw, block.title)) &&
      block.startTime === draft.startTime &&
      block.endTime === draft.endTime,
  );
}

export function daysToCreate(draft: ScheduleDraft, existing: ExistingClass[]): number[] {
  const uniqueDays = [...new Set(draft.days)].filter((day) => day >= 1 && day <= 7);
  if (draft.duplicateAction === "create" || draft.duplicateAction === "replace") {
    return uniqueDays;
  }
  const dupDays = new Set(matchDuplicates(draft, existing).map((block) => block.dayOfWeek));
  return uniqueDays.filter((day) => !dupDays.has(day));
}

export function countBlocksToCreate(drafts: ScheduleDraft[], existing: ExistingClass[]): number {
  return drafts.reduce((sum, draft) => {
    if (rowBlockers(draft).length > 0) return sum;
    return sum + daysToCreate(draft, existing).length;
  }, 0);
}

export function overlappingDrafts(drafts: ScheduleDraft[]): Map<string, string[]> {
  const hits = new Map<string, string[]>();
  for (let i = 0; i < drafts.length; i += 1) {
    for (let j = i + 1; j < drafts.length; j += 1) {
      const a = drafts[i];
      const b = drafts[j];
      if (!a || !b) continue;
      if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) continue;
      const sameDay = a.days.some((day) => b.days.includes(day));
      if (!sameDay) continue;
      if (a.startTime < b.endTime && b.startTime < a.endTime) {
        const aTitle = a.title.trim() || "Clase";
        const bTitle = b.title.trim() || "Clase";
        hits.set(a.id, [...(hits.get(a.id) ?? []), bTitle]);
        hits.set(b.id, [...(hits.get(b.id) ?? []), aTitle]);
      }
    }
  }
  return hits;
}

export function toImportItems(drafts: ScheduleDraft[], existing: ExistingClass[]) {
  return drafts
    .filter((draft) => rowBlockers(draft).length === 0)
    .map((draft) => ({
      title: composeClassTitle(draft),
      days: daysToCreate(draft, existing),
      startTime: draft.startTime,
      endTime: draft.endTime,
      location: composeClassLocation(draft),
      action: draft.duplicateAction,
    }))
    .filter((item) => item.days.length > 0);
}
