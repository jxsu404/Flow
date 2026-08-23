"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ISO_DAY_ABBR } from "@/lib/datetime";
import {
  countBlocksToCreate,
  emptyDraft,
  IMPORT_ACCEPT,
  IMPORT_FORMAT_HINT,
  isAllowedImportFile,
  matchDuplicates,
  overlappingDrafts,
  rowBlockers,
  rowNeedsReview,
  toImportItems,
  type DuplicateAction,
  type ExistingClass,
  type ScheduleDraft,
} from "@/lib/schedule-import";
import { cn } from "@/lib/utils";

const ANALYZE_HINTS = [
  "Detectando clases y horarios.",
  "Leyendo días, aulas y materias.",
  "Organizando lo que se ve con claridad.",
];

type Step = "upload" | "analyzing" | "review" | "success";

function DayToggles({
  value,
  onChange,
  invalid,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  invalid?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1", invalid && "rounded-lg ring-1 ring-amber-500/40")}>
      {([1, 2, 3, 4, 5, 6, 7] as const).map((day) => {
        const on = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={on}
            onClick={() =>
              onChange(on ? value.filter((item) => item !== day) : [...value, day].sort((a, b) => a - b))
            }
            className={cn(
              "flex h-7 min-w-8 items-center justify-center rounded-lg px-1.5 text-[11px] font-medium transition-colors",
              on
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {ISO_DAY_ABBR[day]}
          </button>
        );
      })}
    </div>
  );
}

function FieldHint({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-500">
      <AlertTriangle className="size-3" />
      {children}
    </p>
  );
}

function DraftCard({
  draft,
  existing,
  overlapWith,
  onChange,
  onRemove,
}: {
  draft: ScheduleDraft;
  existing: ExistingClass[];
  overlapWith: string[];
  onChange: (next: ScheduleDraft) => void;
  onRemove: () => void;
}) {
  const blockers = rowBlockers(draft);
  const dupes = matchDuplicates(draft, existing);
  const uncertain = draft.uncertain;

  function patch(update: Partial<ScheduleDraft>, clear?: keyof ScheduleDraft["uncertain"]) {
    const nextUncertain = { ...draft.uncertain };
    if (clear) nextUncertain[clear] = false;
    onChange({ ...draft, ...update, uncertain: nextUncertain });
  }

  return (
    <div className="rounded-xl bg-card px-3 py-3 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Label htmlFor={`title-${draft.id}`} className="sr-only">
            Materia
          </Label>
          <Input
            id={`title-${draft.id}`}
            value={draft.title}
            placeholder="Nombre de la materia"
            aria-invalid={Boolean(uncertain.title) || blockers.includes("Nombre de materia")}
            onChange={(event) => patch({ title: event.target.value }, "title")}
          />
          <FieldHint show={Boolean(uncertain.title) || blockers.includes("Nombre de materia")}>
            Nombre no identificado con claridad
          </FieldHint>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          Quitar
        </Button>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Días</p>
        <DayToggles
          value={draft.days}
          invalid={Boolean(uncertain.days) || blockers.includes("Día")}
          onChange={(days) => patch({ days }, "days")}
        />
        <FieldHint show={Boolean(uncertain.days) || blockers.includes("Día")}>
          Día no identificado con claridad
        </FieldHint>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={`start-${draft.id}`}>Inicio</Label>
          <Input
            id={`start-${draft.id}`}
            type="time"
            value={draft.startTime}
            aria-invalid={Boolean(uncertain.startTime) || blockers.includes("Horario")}
            onChange={(event) => patch({ startTime: event.target.value }, "startTime")}
          />
        </div>
        <div>
          <Label htmlFor={`end-${draft.id}`}>Fin</Label>
          <Input
            id={`end-${draft.id}`}
            type="time"
            value={draft.endTime}
            aria-invalid={Boolean(uncertain.endTime) || blockers.includes("Horario")}
            onChange={(event) => patch({ endTime: event.target.value }, "endTime")}
          />
        </div>
      </div>
      <FieldHint show={Boolean(uncertain.startTime || uncertain.endTime) || blockers.includes("Horario")}>
        Horario no identificado con claridad
      </FieldHint>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={`prof-${draft.id}`}>Profesor</Label>
          <Input
            id={`prof-${draft.id}`}
            value={draft.professor}
            placeholder="Si aparece"
            aria-invalid={Boolean(uncertain.professor)}
            onChange={(event) => patch({ professor: event.target.value }, "professor")}
          />
          <FieldHint show={Boolean(uncertain.professor)}>Profesor no identificado con claridad</FieldHint>
        </div>
        <div>
          <Label htmlFor={`aula-${draft.id}`}>Aula</Label>
          <Input
            id={`aula-${draft.id}`}
            value={draft.location}
            placeholder="Si aparece"
            aria-invalid={Boolean(uncertain.location)}
            onChange={(event) => patch({ location: event.target.value }, "location")}
          />
          <FieldHint show={Boolean(uncertain.location)}>Aula no identificada con claridad</FieldHint>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={`code-${draft.id}`}>Código</Label>
          <Input
            id={`code-${draft.id}`}
            value={draft.courseCode}
            placeholder="Opcional"
            onChange={(event) => patch({ courseCode: event.target.value }, "courseCode")}
          />
        </div>
        <div>
          <Label htmlFor={`sec-${draft.id}`}>Grupo</Label>
          <Input
            id={`sec-${draft.id}`}
            value={draft.section}
            placeholder="Opcional"
            onChange={(event) => patch({ section: event.target.value }, "section")}
          />
        </div>
      </div>

      {draft.issues.map((issue) => (
        <p key={issue} className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <AlertTriangle className="size-3 text-amber-500" />
          {issue}
        </p>
      ))}

      {overlapWith.length > 0 ? (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <AlertTriangle className="size-3 text-amber-500" />
          Horario superpuesto con {overlapWith.join(", ")}
        </p>
      ) : null}

      {dupes.length > 0 ? (
        <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 ring-1 ring-foreground/10">
          <p className="text-xs text-muted-foreground">Esta clase parece existir ya.</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {(
              [
                ["keep", "Mantener la existente"],
                ["replace", "Reemplazarla"],
                ["create", "Crear una nueva"],
              ] as const satisfies ReadonlyArray<readonly [DuplicateAction, string]>
            ).map(([action, label]) => (
              <Button
                key={action}
                type="button"
                size="xs"
                variant={draft.duplicateAction === action ? "default" : "outline"}
                onClick={() => patch({ duplicateAction: action })}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ScheduleImportDialog({
  open,
  onOpenChange,
  existing,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: ExistingClass[];
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [documentWarning, setDocumentWarning] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ScheduleDraft[]>([]);
  const [importing, setImporting] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  useEffect(() => {
    if (step !== "analyzing") return;
    const timer = window.setInterval(() => {
      setHintIndex((index) => (index + 1) % ANALYZE_HINTS.length);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [step]);

  function reset() {
    setStep("upload");
    setDragOver(false);
    setHintIndex(0);
    setDocumentWarning(null);
    setDrafts([]);
    setImporting(false);
    setCreatedCount(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  function close() {
    if (step === "analyzing" || importing) return;
    onOpenChange(false);
    window.setTimeout(reset, 150);
  }

  async function analyze(file: File) {
    const allowed = isAllowedImportFile(file);
    if (!allowed.ok) {
      toast.error(allowed.error);
      return;
    }
    setStep("analyzing");
    setHintIndex(0);
    setDocumentWarning(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/classes/parse", { method: "POST", body });
      const data = (await response.json()) as {
        error?: string;
        documentWarning?: string | null;
        classes?: ScheduleDraft[];
      };
      if (!response.ok) {
        toast.error(data.error ?? "No pude analizar el horario.");
        setStep("upload");
        return;
      }
      const classes = (data.classes ?? []).map((row) => {
        const draft = emptyDraft(row);
        const dupes = matchDuplicates(draft, existing);
        return {
          ...draft,
          duplicateAction: (dupes.length ? "keep" : "create") as DuplicateAction,
        };
      });
      setDocumentWarning(
        data.documentWarning ??
          (classes.length === 0
            ? "No pude identificar clases en ese documento. Prueba con una foto más nítida o agrégalas a mano."
            : null),
      );
      setDrafts(classes);
      setStep("review");
    } catch {
      toast.error("No pude analizar el horario. Inténtalo de nuevo.");
      setStep("upload");
    }
  }

  async function confirmImport() {
    const items = toImportItems(drafts, existing);
    if (items.length === 0) {
      toast.error("Completa al menos una clase con nombre, días y horario.");
      return;
    }
    setImporting(true);
    try {
      const response = await fetch("/api/classes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = (await response.json()) as { created?: number; error?: string; errors?: string[] };
      if (!response.ok) {
        toast.error(data.error ?? "No pude importar las clases.");
        return;
      }
      setCreatedCount(data.created ?? items.reduce((sum, item) => sum + item.days.length, 0));
      setStep("success");
      onImported();
      if (data.errors?.length) {
        toast.error(data.errors[0]);
      }
    } catch {
      toast.error("No pude importar las clases. Inténtalo de nuevo.");
    } finally {
      setImporting(false);
    }
  }

  const createCount = countBlocksToCreate(drafts, existing);
  const reviewCount = drafts.filter((draft) => rowNeedsReview(draft)).length;
  const overlaps = overlappingDrafts(drafts);
  const incomplete = drafts.filter((draft) => rowBlockers(draft).length > 0).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent
        showCloseButton={step !== "analyzing"}
        className="flex max-h-[min(90vh,760px)] w-full flex-col sm:max-w-2xl"
      >
        {step === "upload" ? (
          <>
            <DialogHeader>
              <DialogTitle>Importa tu horario</DialogTitle>
              <DialogDescription>
                Sube una imagen o PDF de tu horario académico y Flow detectará automáticamente tus clases y
                horarios.
              </DialogDescription>
            </DialogHeader>
            <button
              type="button"
              onDragEnter={() => setDragOver(true)}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                const file = event.dataTransfer.files[0];
                if (file) void analyze(file);
              }}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
                dragOver
                  ? "border-primary bg-primary/10"
                  : "border-border bg-muted/20 hover:bg-muted/40",
              )}
            >
              <Upload className="size-6 text-muted-foreground" />
              <div>
                <p className="font-medium">Arrastra tu horario aquí</p>
                <p className="mt-1 text-xs text-muted-foreground">o haz clic para elegir un archivo</p>
              </div>
              <p className="text-[11px] text-muted-foreground">{IMPORT_FORMAT_HINT}</p>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={IMPORT_ACCEPT}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void analyze(file);
              }}
            />
          </>
        ) : null}

        {step === "analyzing" ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Flow</p>
            <div className="h-1 w-48 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
            </div>
            <div>
              <p className="font-medium">Analizando tu horario…</p>
              <p className="mt-1 text-sm text-muted-foreground">{ANALYZE_HINTS[hintIndex]}</p>
            </div>
          </div>
        ) : null}

        {step === "review" ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {drafts.length === 0
                  ? "No encontramos clases"
                  : `Hemos encontrado ${drafts.length} clase${drafts.length === 1 ? "" : "s"}`}
              </DialogTitle>
              <DialogDescription>
                Revisa y corrige antes de crearlas. Si algo no se leyó bien, déjalo vacío o ajústalo — no
                inventamos datos.
              </DialogDescription>
            </DialogHeader>
            {documentWarning ? (
              <p className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground ring-1 ring-foreground/10">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                {documentWarning}
              </p>
            ) : null}
            {incomplete > 0 ? (
              <p className="text-xs text-muted-foreground">
                No pudimos identificar algunas clases con suficiente claridad. Completa o quita {incomplete}{" "}
                para continuar.
              </p>
            ) : null}
            <div className="flex max-h-[min(48vh,420px)] flex-col gap-3 overflow-y-auto pr-1">
                {drafts.map((draft) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft}
                    existing={existing}
                    overlapWith={overlaps.get(draft.id) ?? []}
                    onChange={(next) =>
                      setDrafts((rows) => rows.map((row) => (row.id === draft.id ? next : row)))
                    }
                    onRemove={() => setDrafts((rows) => rows.filter((row) => row.id !== draft.id))}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => setDrafts((rows) => [...rows, emptyDraft()])}
                >
                  <Plus />
                  Agregar clase
                </Button>
              </div>
            {reviewCount > 0 && createCount > 0 ? (
              <p className="text-[11px] text-muted-foreground">
                {reviewCount} aún tienen campos por revisar; se importarán solo las que estén completas.
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancelar
              </Button>
              <Button type="button" disabled={importing || createCount === 0} onClick={() => void confirmImport()}>
                {importing
                  ? "Importando…"
                  : `Importar ${createCount} clase${createCount === 1 ? "" : "s"}`}
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {step === "success" ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Flow</p>
            <DialogHeader className="items-center">
              <DialogTitle>¡Horario importado!</DialogTitle>
              <DialogDescription>
                Se agregaron {createdCount} clase{createdCount === 1 ? "" : "s"} a tu horario.
              </DialogDescription>
            </DialogHeader>
            <Button type="button" onClick={close}>
              Listo
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
