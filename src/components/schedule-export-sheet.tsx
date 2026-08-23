"use client";

import type { RefObject } from "react";
import {
  classTimeBounds,
  groupClassesByDay,
  timeToMinutes,
  type ClassExportBlock,
} from "@/lib/schedule-export";

function formatHour(min: number) {
  const hours = Math.floor(min / 60);
  return `${String(hours).padStart(2, "0")}:00`;
}

export function ScheduleExportSheet({
  blocks,
  captureRef,
}: {
  blocks: ClassExportBlock[];
  captureRef: RefObject<HTMLDivElement | null>;
}) {
  const days = groupClassesByDay(blocks);
  const { startMin, endMin } = classTimeBounds(blocks);
  const span = Math.max(60, endMin - startMin);
  const hours: number[] = [];
  for (let t = startMin; t < endMin; t += 60) hours.push(t);
  const gridHeight = Math.max(220, (span / 60) * 52);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: -12000,
        top: 0,
        width: 1100,
        background: "#ffffff",
        color: "#171717",
        padding: 28,
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <div ref={captureRef} style={{ background: "#ffffff", color: "#171717", padding: 8 }}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#6b7280",
            margin: 0,
          }}
        >
          Flow
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 600, margin: "8px 0 4px" }}>Horario de clases</h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 18px" }}>
          Lunes a domingo
          {blocks.length ? ` · ${blocks.length} clase${blocks.length === 1 ? "" : "s"}` : ""}
        </p>

        <div style={{ display: "flex", gap: 0 }}>
          <div style={{ width: 44, position: "relative", height: gridHeight, marginTop: 28 }}>
            {hours.map((hour) => (
              <div
                key={hour}
                style={{
                  position: "absolute",
                  top: `${((hour - startMin) / span) * 100}%`,
                  right: 6,
                  fontSize: 10,
                  color: "#6b7280",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  transform: "translateY(-50%)",
                }}
              >
                {formatHour(hour)}
              </div>
            ))}
          </div>
          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: 6,
            }}
          >
            {days.map((day) => (
              <div key={day.dayOfWeek}>
                <p
                  style={{
                    margin: "0 0 8px",
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#171717",
                  }}
                >
                  {day.abbr}
                </p>
                <div
                  style={{
                    position: "relative",
                    height: gridHeight,
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  {hours.map((hour) => (
                    <div
                      key={`${day.dayOfWeek}-${hour}`}
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: `${((hour - startMin) / span) * 100}%`,
                        borderTop: "1px solid #e5e7eb",
                      }}
                    />
                  ))}
                  {day.items.map((item) => {
                    const start = timeToMinutes(item.startTime);
                    const end = timeToMinutes(item.endTime);
                    const top = ((start - startMin) / span) * 100;
                    const height = Math.max(8, ((end - start) / span) * 100);
                    return (
                      <div
                        key={`${item.title}-${item.startTime}`}
                        style={{
                          position: "absolute",
                          left: 4,
                          right: 4,
                          top: `${top}%`,
                          height: `${height}%`,
                          background: "#0f766e",
                          color: "#ffffff",
                          borderRadius: 6,
                          padding: "4px 6px",
                          overflow: "hidden",
                          boxSizing: "border-box",
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>{item.title}</div>
                        <div style={{ fontSize: 10, opacity: 0.9, marginTop: 2 }}>
                          {item.startTime}–{item.endTime}
                        </div>
                        {item.location ? (
                          <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>{item.location}</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          {days
            .filter((day) => day.items.length > 0)
            .map((day) => (
              <div key={`list-${day.dayOfWeek}`} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
                <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 13 }}>{day.label}</p>
                {day.items.map((item) => (
                  <div
                    key={`${day.dayOfWeek}-${item.title}-${item.startTime}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      fontSize: 12,
                      marginBottom: 6,
                    }}
                  >
                    <span>
                      {item.title}
                      {item.location ? ` · ${item.location}` : ""}
                    </span>
                    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#6b7280" }}>
                      {item.startTime}–{item.endTime}
                    </span>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
