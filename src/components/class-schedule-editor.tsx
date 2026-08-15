"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const days = [1, 2, 3, 4, 5, 6, 7];

export function ClassScheduleEditor({ initial }: { initial: ClassBlock[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [pending, setPending] = useState(false);
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
        </CardHeader>
        <CardContent>
          {blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay clases. Agrégalas aquí o dilo por voz: “Lunes matemáticas de 8 a 10”.
            </p>
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
  );
}
