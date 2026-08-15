import { formatInTimeZone } from "date-fns-tz";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Item } from "@/db/schema";
import type { DashboardData } from "@/lib/dashboard";

const typeLabel: Record<Item["type"], string> = {
  task: "Tarea",
  assignment: "Entrega",
  exam: "Examen",
  event: "Evento",
};

const priorityLabel: Record<Item["priority"], string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

function ItemRow({ item, timeZone }: { item: Item; timeZone: string }) {
  const when = item.dueAt
    ? formatInTimeZone(item.dueAt, timeZone, "EEE d MMM HH:mm")
    : item.startAt
      ? formatInTimeZone(item.startAt, timeZone, "EEE d MMM HH:mm")
      : "Sin fecha";
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-3 last:border-0">
      <div>
        <p className="font-medium leading-tight">{item.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{when}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge variant="secondary">{typeLabel[item.type]}</Badge>
        {item.priority === "high" ? <Badge>{priorityLabel[item.priority]}</Badge> : null}
      </div>
    </div>
  );
}

export function DashboardView({ data }: { data: DashboardData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Hoy · {data.todayLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.todayClasses.length === 0 && data.todayItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada fijo para hoy. Usa la barra de comando.</p>
          ) : null}
          {data.todayClasses.map((block) => (
            <div key={block.id} className="flex justify-between border-b border-border/50 py-3 text-sm last:border-0">
              <span>
                {block.title}
                {block.location ? ` · ${block.location}` : ""}
              </span>
              <span className="text-muted-foreground">{block.when}</span>
            </div>
          ))}
          {data.todayItems.map((item) => (
            <ItemRow key={item.id} item={item} timeZone={data.timeZone} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Qué hacer primero</CardTitle>
        </CardHeader>
        <CardContent>
          {data.priorities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin prioridades todavía.</p>
          ) : (
            data.priorities.map((item) => (
              <ItemRow key={item.id} item={item} timeZone={data.timeZone} />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entregas y exámenes</CardTitle>
        </CardHeader>
        <CardContent>
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay entregas próximas.</p>
          ) : (
            data.upcoming.map((item) => (
              <ItemRow key={item.id} item={item} timeZone={data.timeZone} />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tiempo libre</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Clases + Calendar + tareas con horario. Flow aún no agenda solo en estos huecos.
          </p>
          {data.freeSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No encontré huecos de 30+ min en los próximos días.</p>
          ) : (
            data.freeSlots.map((slot) => (
              <div key={slot.start.toISOString()} className="border-b border-border/50 py-2 text-sm last:border-0">
                {slot.label}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Google Calendar</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4 text-sm">
          <p className="text-muted-foreground">
            {data.calendarConnected
              ? "Conectado. Los eventos y recordatorios se crean en tu calendario principal."
              : "No pude confirmar permisos de Calendar. Vuelve a entrar con Google y acepta el acceso a eventos."}
          </p>
          <Badge variant={data.calendarConnected ? "default" : "secondary"}>
            {data.calendarConnected ? "Sincronizado" : "Pendiente"}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
