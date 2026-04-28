import { PDFDocument, rgb } from "pdf-lib";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { Annotation } from "./types";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 1, g: 1, b: 0 };
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}

export async function exportAnnotatedPdf(
  originalData: Uint8Array,
  annotations: Annotation[],
  fileName: string
): Promise<void> {
  const pdfDoc = await PDFDocument.load(originalData.slice());
  const pages = pdfDoc.getPages();

  for (const ann of annotations) {
    if (ann.type !== "highlight" || !ann.rects) continue;
    const pageIndex = ann.page - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { width, height } = page.getSize();
    const color = hexToRgb(ann.color);

    for (const rect of ann.rects) {
      page.drawRectangle({
        x: rect.x * width,
        y: height - (rect.y * height + rect.height * height),
        width: rect.width * width,
        height: rect.height * height,
        color: rgb(color.r, color.g, color.b),
        opacity: 0.35,
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  const baseName = fileName.replace(/\.pdf$/i, "");

  const savePath = await save({
    defaultPath: `${baseName}-annotated.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!savePath) return;

  await writeFile(savePath, new Uint8Array(pdfBytes));
}

export async function exportMarkdown(
  annotations: Annotation[],
  fileName: string
): Promise<void> {
  const lines: string[] = [];
  lines.push(`# Annotations: ${fileName}`);
  lines.push(`\nExported: ${new Date().toLocaleString()}\n`);

  const byPage = new Map<number, Annotation[]>();
  for (const ann of annotations) {
    const list = byPage.get(ann.page) ?? [];
    list.push(ann);
    byPage.set(ann.page, list);
  }

  const sortedPages = [...byPage.keys()].sort((a, b) => a - b);

  for (const page of sortedPages) {
    lines.push(`## Page ${page}\n`);
    const pageAnns = byPage.get(page)!;
    for (const ann of pageAnns) {
      if (ann.selectedText) {
        lines.push(`> ${ann.selectedText}\n`);
      }
      if (ann.type === "region" && ann.region) {
        lines.push(
          `*Region annotation at (${Math.round(ann.region.x * 100)}%, ${Math.round(ann.region.y * 100)}%)*\n`
        );
      }
      if (ann.note) {
        lines.push(`${ann.note}\n`);
      }
      lines.push(`---\n`);
    }
  }

  const markdown = lines.join("\n");
  const baseName = fileName.replace(/\.[^.]+$/, "");

  const savePath = await save({
    defaultPath: `${baseName}-notes.md`,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (!savePath) return;

  const encoder = new TextEncoder();
  await writeFile(savePath, encoder.encode(markdown));
}
