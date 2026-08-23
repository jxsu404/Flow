"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileDown, ImageDown, Upload } from "lucide-react";
import { toast } from "sonner";
import { ScheduleExportSheet } from "@/components/schedule-export-sheet";
import { ScheduleImportDialog } from "@/components/schedule-import-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClassBlock } from "@/db/schema";
import { ISO_DAY_LABELS } from "@/lib/datetime";
import { saveSchedulePdf, saveSchedulePng } from "@/lib/schedule-export";

const days = [1, 2, 3, 4, 5, 6, 7];

export function ClassScheduleEditor({ initial }: { initial: ClassBlock[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [pending, setPending] = useState(false);
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const blocks = [...initial].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.startTime.localeCompare(b.startTime);
  });

  async function addClass(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, dayOfWeek, startTime, endTime, location }),
      });
      if (!response.ok) {
        toast.error("No pude guardar la clase");
        return;
      }
      setTitle("");
      setLocation("");
      toast.success("Clase agregada");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function exportSchedule(kind: "png" | "pdf") {
    const node = exportRef.current;
    if (!node) {
      toast.error("No pude preparar el horario para exportar.");
      return;
    }
    setExporting(kind);
    try {
      if (kind === "png") await saveSchedulePng(node);
      else await saveSchedulePdf(node);
      toast.success(kind === "png" ? "Imagen descargada." : "PDF descargado.");
    } catch {
      toast.error("No pude exportar el horario. Inténtalo de nuevo.");
    } finally {
      setExporting(null);
    }
  }

  async function remove(id: string) {
    const response = await fetch(`/api/classes?id=${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("No pude eliminar la clase");
      return;
    }
    toast.success("Clase eliminada");
    router.refresh();
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle>Nueva clase</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={addClass}>
            <div className="grid gap-1.5">
              <Label htmlFor="title">Materia</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label>Día</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {days.map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {ISO_DAY_LABELS[day]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="start">Inicio</Label>
                <Input id="start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="end">Fin</Label>
                <Input id="end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="location">Aula (opcional)</Label>
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <Button type="submit" disabled={pending || !title.trim()}>
              Guardar
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Semana</CardTitle>
          <CardAction className="flex flex-wrap justify-end gap-1">
            <Button
              type="button"
              size="sm"
              aria-label="Importar horario"
              onClick={() => setImportOpen(true)}
            >
              <Upload />
              Importar horario
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Exportar horario como imagen"
              disabled={exporting !== null}
              onClick={() => void exportSchedule("png")}
            >
              <ImageDown />
              {exporting === "png" ? "Preparando…" : "Imagen"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Exportar horario como PDF"
              disabled={exporting !== null}
              onClick={() => void exportSchedule("pdf")}
            >
              <FileDown />
              {exporting === "pdf" ? "Preparando…" : "PDF"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {blocks.length === 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Aún no hay clases. Agrégalas aquí, dilo por voz: “Lunes matemáticas de 8 a 10”, o sube una foto de tu horario.
              </p>
              <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setImportOpen(true)}>
                <Upload />
                Importar horario
              </Button>
            </div>
          ) : (
            blocks.map((block) => (
              <div key={block.id} className="flex items-center justify-between gap-3 border-b border-border/50 py-3 last:border-0">
                <div>
                  <p className="font-medium">{block.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {ISO_DAY_LABELS[block.dayOfWeek]} · {block.startTime}–{block.endTime}
                    {block.location ? ` · ${block.location}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void remove(block.id)}>
                  Quitar
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      </div>
      <ScheduleExportSheet blocks={blocks} captureRef={exportRef} />
      <ScheduleImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        existing={blocks}
        onImported={() => router.refresh()}
      />
    </>
  );
}
