"use client";

import { formatInTimeZone } from "date-fns-tz";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Item } from "@/db/schema";

const typeLabel: Record<Item["type"], string> = {
  task: "Tarea",
  assignment: "Entrega",
  exam: "Examen",
  event: "Evento",
};

export function TaskList({ items, timeZone }: { items: Item[]; timeZone: string }) {
  const router = useRouter();

  async function setStatus(id: string, status: Item["status"]) {
    const response = await fetch("/api/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!response.ok) {
      toast.error("No pude actualizar la tarea");
      return;
    }
    router.refresh();
  }

  async function remove(id: string) {
    const response = await fetch(`/api/items?id=${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("No pude eliminar");
      return;
    }
    toast.success("Eliminado");
    router.refresh();
  }

  const pending = items.filter((item) => item.status === "pending");
  const done = items.filter((item) => item.status !== "pending");

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Pendiente</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada pendiente.</p>
          ) : (
            pending.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 border-b border-border/50 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.dueAt ? formatInTimeZone(item.dueAt, timeZone, "d MMM yyyy HH:mm") : "Sin fecha"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{typeLabel[item.type]}</Badge>
                  <Button size="sm" variant="outline" onClick={() => void setStatus(item.id, "done")}>
                    Hecha
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void remove(item.id)}>
                    Borrar
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      {done.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Completadas</CardTitle>
          </CardHeader>
          <CardContent>
            {done.map((item) => (
              <div key={item.id} className="flex justify-between py-2 text-sm text-muted-foreground">
                <span className="line-through">{item.title}</span>
                <Button size="sm" variant="ghost" onClick={() => void setStatus(item.id, "pending")}>
                  Restaurar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
