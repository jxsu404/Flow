"use client";

import { ISO_DAY_ABBR, ISO_DAY_LABELS, parseHm } from "@/lib/datetime";

export const CLASS_SCHEDULE_STEM = "horario-clases-flow";

export type ClassExportBlock = {
  title: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location?: string | null;
};

export type ClassExportDay = {
  dayOfWeek: number;
  label: string;
  abbr: string;
  items: ClassExportBlock[];
};

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export function timeToMinutes(value: string): number {
  const { hours, minutes } = parseHm(value);
  return hours * 60 + minutes;
}

export function groupClassesByDay(blocks: ClassExportBlock[]): ClassExportDay[] {
  return WEEK_DAYS.map((dayOfWeek) => ({
    dayOfWeek,
    label: ISO_DAY_LABELS[dayOfWeek] ?? `Día ${dayOfWeek}`,
    abbr: ISO_DAY_ABBR[dayOfWeek] ?? String(dayOfWeek),
    items: blocks
      .filter((block) => block.dayOfWeek === dayOfWeek)
      .slice()
      .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime)),
  }));
}

export function classTimeBounds(blocks: ClassExportBlock[]): { startMin: number; endMin: number } {
  if (blocks.length === 0) return { startMin: 8 * 60, endMin: 16 * 60 };
  let startMin = Infinity;
  let endMin = 0;
  for (const block of blocks) {
    startMin = Math.min(startMin, timeToMinutes(block.startTime));
    endMin = Math.max(endMin, timeToMinutes(block.endTime));
  }
  const startHour = Math.floor(startMin / 60) * 60;
  const endHour = Math.max(startHour + 60, Math.ceil(endMin / 60) * 60);
  return { startMin: startHour, endMin: endHour };
}

function downloadBlob(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function captureNodePng(node: HTMLElement): Promise<string> {
  const { toPng } = await import("html-to-image");
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  return toPng(node, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    cacheBust: true,
    width: node.scrollWidth,
    height: node.scrollHeight,
  });
}

export async function saveSchedulePng(node: HTMLElement, stem = CLASS_SCHEDULE_STEM) {
  const dataUrl = await captureNodePng(node);
  downloadBlob(dataUrl, `${stem}.png`);
}

export async function saveSchedulePdf(node: HTMLElement, stem = CLASS_SCHEDULE_STEM) {
  const dataUrl = await captureNodePng(node);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("No pude leer la imagen del horario"));
    img.src = dataUrl;
  });

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 8;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2;
  const renderedH = (img.height * usableW) / img.width;

  if (renderedH <= usableH) {
    pdf.addImage(dataUrl, "PNG", margin, margin, usableW, renderedH);
  } else {
    const pageHeightPx = (img.width * usableH) / usableW;
    let offset = 0;
    let first = true;
    while (offset < img.height) {
      if (!first) pdf.addPage();
      first = false;
      const slice = document.createElement("canvas");
      const sliceH = Math.min(pageHeightPx, img.height - offset);
      slice.width = img.width;
      slice.height = sliceH;
      const ctx = slice.getContext("2d");
      if (!ctx) throw new Error("No pude recortar el PDF");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(img, 0, offset, img.width, sliceH, 0, 0, img.width, sliceH);
      const sliceUrl = slice.toDataURL("image/png");
      const sliceMm = (sliceH * usableW) / img.width;
      pdf.addImage(sliceUrl, "PNG", margin, margin, usableW, sliceMm);
      offset += sliceH;
    }
  }

  pdf.save(`${stem}.pdf`);
}
