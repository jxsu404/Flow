"use client";

import type { RefObject } from "react";
import type { ScheduleDay, SchedulePart, ScheduleSegment } from "@/lib/day-plan";

const busyKindLabel: Record<string, string> = {
  class: "Clase",
  exam: "Examen",
  event: "Evento",
  calendar: "Calendar",
  assignment: "Entrega",
  task: "Tarea",
};

const AWAKE = 15 * 60;

function Bar({ segments }: { segments: ScheduleSegment[] }) {
  return (
    <div
      style={{
        position: "relative",
        height: 18,
        overflow: "hidden",
        borderRadius: 6,
        background: "#f3f4f6",
        border: "1px solid #e5e7eb",
      }}
    >
      {segments.map((segment) => (
        <div
          key={`${segment.type}-${segment.rangeLabel}`}
          style={{
            position: "absolute",
            top: 0,
            height: "100%",
            left: `${Math.max(0, (segment.startMin / AWAKE) * 100)}%`,
            width: `${Math.max(1.2, (segment.durationMin / AWAKE) * 100)}%`,
            background: segment.type === "busy" ? "#171717" : "#99f6e4",
          }}
        />
      ))}
    </div>
  );
}

function PartBlock({ part }: { part: SchedulePart }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        <span>{part.part}</span>
        <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{part.rangeLabel}</span>
      </div>
      <div style={{ marginTop: 6 }}>
        <Bar segments={part.segments} />
      </div>
      {part.segments.map((segment) => (
        <div
          key={`${segment.type}-${segment.rangeLabel}`}
          style={{
            marginTop: 6,
            padding: "8px 10px",
            borderRadius: 8,
            background: segment.type === "busy" ? "#f3f4f6" : "#f9fafb",
            border: segment.type === "free" ? "1px dashed #d1d5db" : "1px solid #e5e7eb",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{segment.title}</span>
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, color: "#6b7280" }}>
              {segment.rangeLabel}
            </span>
          </div>
          {segment.type === "busy" && segment.kind ? (
            <div style={{ marginTop: 4, fontSize: 11, color: "#6b7280" }}>
              {busyKindLabel[segment.kind] ?? segment.kind}
            </div>
          ) : null}
          {segment.suggestionTitle ? (
            <div style={{ marginTop: 4, fontSize: 11, color: "#6b7280" }}>
              Puedes avanzar {segment.suggestionTitle}
              {segment.suggestionDue ? ` · ${segment.suggestionDue}` : ""}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function ScheduleExportSheet({
  days,
  captureRef,
}: {
  days: ScheduleDay[];
  captureRef: RefObject<HTMLDivElement | null>;
}) {
  const first = days[0];
  const last = days[days.length - 1];
  const range =
    first && last ? `${first.weekday} ${first.date} – ${last.weekday} ${last.date}` : "";

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: -12000,
        top: 0,
        width: 900,
        background: "#ffffff",
        color: "#171717",
        padding: 36,
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <div ref={captureRef} style={{ background: "#ffffff", color: "#171717", padding: 8 }}>
        <p style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#6b7280", margin: 0 }}>
          Flow
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 600, margin: "8px 0 4px" }}>Horario semanal</h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>{range} · 07:00–22:00</p>
        <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#6b7280", marginBottom: 20 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, background: "#171717", display: "inline-block", borderRadius: 2 }} />
            Ocupado
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, background: "#99f6e4", display: "inline-block", borderRadius: 2 }} />
            Libre
          </span>
        </div>

        {days.map((day) => (
          <section
            key={day.date}
            style={{
              marginBottom: 22,
              paddingBottom: 18,
              borderBottom: "1px solid #e5e7eb",
              breakInside: "avoid",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                {day.heading}
                {day.isToday ? " · Hoy" : ""}
              </h2>
            </div>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 10px" }}>{day.summary}</p>
            <Bar segments={day.parts.flatMap((part) => part.segments)} />
            {day.parts.map((part) => (
              <PartBlock key={part.part} part={part} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
