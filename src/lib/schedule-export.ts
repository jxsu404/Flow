"use client";

import type { ScheduleDay } from "@/lib/day-plan";

export function weekFileStem(days: ScheduleDay[]): string {
  const first = days[0]?.date ?? "semana";
  const last = days[days.length - 1]?.date ?? first;
  return `horario-flow-${first}_${last}`;
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

export async function saveSchedulePng(node: HTMLElement, days: ScheduleDay[]) {
  const dataUrl = await captureNodePng(node);
  downloadBlob(dataUrl, `${weekFileStem(days)}.png`);
}

export async function saveSchedulePdf(node: HTMLElement, days: ScheduleDay[]) {
  const dataUrl = await captureNodePng(node);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("No pude leer la imagen del horario"));
    img.src = dataUrl;
  });

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 10;
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

  pdf.save(`${weekFileStem(days)}.pdf`);
}
