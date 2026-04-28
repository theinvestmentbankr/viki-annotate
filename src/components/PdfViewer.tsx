import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { Annotation, AnnotationRect } from "../types";
import { saveAnnotation } from "../db";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export type Tool = "highlight" | "draw";

interface PdfViewerProps {
  fileData: Uint8Array;
  fileName: string;
  filePath: string;
  annotations: Annotation[];
  onAnnotationsChange: () => void;
  onAnnotationClick: (annotation: Annotation) => void;
  onHoverAnnotation: (id: string | null) => void;
  hoveredAnnotationId: string | null;
  selectedColor: string;
  tool: Tool;
}

export default function PdfViewer({
  fileData,
  fileName,
  filePath,
  annotations,
  onAnnotationsChange,
  onAnnotationClick,
  onHoverAnnotation,
  hoveredAnnotationId,
  selectedColor,
  tool,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [drawCurrent, setDrawCurrent] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadPdf = async () => {
      const loadingTask = pdfjsLib.getDocument({ data: fileData.slice() });
      const pdf = await loadingTask.promise;
      if (cancelled) return;
      pdfDocRef.current = pdf;
      setNumPages(pdf.numPages);
      setPageNum(1);
    };
    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [fileData]);

  const renderHighlights = useCallback(
    (
      layer: HTMLElement,
      page: number,
      viewport: { width: number; height: number }
    ) => {
      layer.innerHTML = "";
      const pageAnnotations = annotations.filter((a) => a.page === page);
      for (const ann of pageAnnotations) {
        const buildOverlay = (rect: AnnotationRect) => {
          const div = document.createElement("div");
          div.className = "pdf-annotation-overlay";
          div.style.position = "absolute";
          div.style.left = `${rect.x * viewport.width}px`;
          div.style.top = `${rect.y * viewport.height}px`;
          div.style.width = `${rect.width * viewport.width}px`;
          div.style.height = `${rect.height * viewport.height}px`;
          div.style.pointerEvents = "auto";
          div.style.cursor = "pointer";
          div.dataset.annotationId = ann.id;

          if (ann.type === "region") {
            div.style.border = `2px solid ${ann.color}`;
            div.style.backgroundColor = `${ann.color}33`;
            div.style.borderRadius = "2px";
          } else {
            div.style.backgroundColor = ann.color;
            div.style.opacity = "0.35";
            div.style.borderRadius = "2px";
          }

          div.addEventListener("click", (e) => {
            e.stopPropagation();
            onAnnotationClick(ann);
          });
          div.addEventListener("mouseenter", () => onHoverAnnotation(ann.id));
          div.addEventListener("mouseleave", () => onHoverAnnotation(null));
          layer.appendChild(div);
        };

        if (ann.rects) {
          for (const rect of ann.rects) buildOverlay(rect);
        }
        if (ann.region) {
          buildOverlay(ann.region);
        }
      }
    },
    [annotations, onAnnotationClick, onHoverAnnotation]
  );

  const renderPage = useCallback(
    async (num: number) => {
      const pdf = pdfDocRef.current;
      if (!pdf || !containerRef.current) return;

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await pdf.getPage(num);
      const viewport = page.getViewport({ scale });

      const container = containerRef.current;
      container.innerHTML = "";

      const wrapper = document.createElement("div");
      wrapper.className = "pdf-page-wrapper";
      wrapper.style.position = "relative";
      wrapper.style.width = `${viewport.width}px`;
      wrapper.style.height = `${viewport.height}px`;
      wrapper.style.margin = "0 auto";
      wrapperRef.current = wrapper;

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d")!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.display = "block";
      wrapper.appendChild(canvas);

      const textLayerDiv = document.createElement("div");
      textLayerDiv.className = "pdf-text-layer";
      textLayerDiv.style.position = "absolute";
      textLayerDiv.style.top = "0";
      textLayerDiv.style.left = "0";
      textLayerDiv.style.width = `${viewport.width}px`;
      textLayerDiv.style.height = `${viewport.height}px`;
      wrapper.appendChild(textLayerDiv);

      const highlightLayer = document.createElement("div");
      highlightLayer.className = "pdf-highlight-layer";
      highlightLayer.style.position = "absolute";
      highlightLayer.style.top = "0";
      highlightLayer.style.left = "0";
      highlightLayer.style.width = `${viewport.width}px`;
      highlightLayer.style.height = `${viewport.height}px`;
      highlightLayer.style.pointerEvents = "none";
      wrapper.appendChild(highlightLayer);

      container.appendChild(wrapper);

      const renderTask = page.render({
        canvasContext: context,
        viewport,
        canvas,
      });
      renderTaskRef.current = renderTask;
      try {
        await renderTask.promise;
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes("cancelled")) return;
        throw e;
      }

      const textContent = await page.getTextContent();
      textLayerDiv.innerHTML = "";
      for (const item of textContent.items) {
        if (!("str" in item)) continue;
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const span = document.createElement("span");
        span.textContent = item.str;
        span.style.position = "absolute";
        span.style.left = `${tx[4]}px`;
        span.style.top = `${tx[5] - item.height * scale}px`;
        span.style.fontSize = `${item.height * scale}px`;
        span.style.fontFamily = "sans-serif";
        span.style.color = "transparent";
        span.style.whiteSpace = "pre";
        span.style.transformOrigin = "0% 0%";
        textLayerDiv.appendChild(span);
      }

      renderHighlights(highlightLayer, num, viewport);
    },
    [scale, renderHighlights]
  );

  useEffect(() => {
    if (numPages > 0) {
      renderPage(pageNum);
    }
  }, [pageNum, numPages, renderPage]);

  // Toggle text-layer interactivity based on tool
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const textLayer = wrapper.querySelector<HTMLElement>(".pdf-text-layer");
    if (!textLayer) return;
    if (tool === "draw") {
      textLayer.style.pointerEvents = "none";
      textLayer.style.userSelect = "none";
    } else {
      textLayer.style.pointerEvents = "";
      textLayer.style.userSelect = "";
    }
  }, [tool, pageNum, numPages]);

  // Imperative draw preview rendered inside the wrapper
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    let preview = wrapper.querySelector<HTMLElement>(".pdf-draw-preview");
    if (!drawCurrent) {
      if (preview) preview.remove();
      return;
    }
    if (!preview) {
      preview = document.createElement("div");
      preview.className = "pdf-draw-preview";
      preview.style.position = "absolute";
      preview.style.pointerEvents = "none";
      preview.style.borderStyle = "dashed";
      preview.style.borderWidth = "2px";
      wrapper.appendChild(preview);
    }
    preview.style.left = `${drawCurrent.x * wrapper.offsetWidth}px`;
    preview.style.top = `${drawCurrent.y * wrapper.offsetHeight}px`;
    preview.style.width = `${drawCurrent.width * wrapper.offsetWidth}px`;
    preview.style.height = `${drawCurrent.height * wrapper.offsetHeight}px`;
    preview.style.borderColor = selectedColor;
    preview.style.backgroundColor = `${selectedColor}33`;
  }, [drawCurrent, selectedColor]);

  // Apply hovered class to matching overlay
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const overlays = wrapper.querySelectorAll<HTMLElement>(
      ".pdf-annotation-overlay"
    );
    overlays.forEach((ov) => {
      if (ov.dataset.annotationId === hoveredAnnotationId) {
        ov.classList.add("hovered");
      } else {
        ov.classList.remove("hovered");
      }
    });
  }, [hoveredAnnotationId, pageNum, annotations]);

  // Text selection → highlight (only in highlight tool mode, and only when selection is inside the wrapper)
  useEffect(() => {
    if (tool !== "highlight") return;

    const handleMouseUp = async () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !containerRef.current) return;

      const wrapper = containerRef.current.querySelector(".pdf-page-wrapper");
      if (!wrapper) return;

      // Ensure selection is inside the PDF wrapper
      const anchorNode = selection.anchorNode;
      if (!anchorNode || !wrapper.contains(anchorNode)) return;

      const selectedText = selection.toString().trim();
      if (!selectedText) return;

      const range = selection.getRangeAt(0);
      const wrapperRect = wrapper.getBoundingClientRect();
      const rects: AnnotationRect[] = [];
      const clientRects = range.getClientRects();

      for (let i = 0; i < clientRects.length; i++) {
        const cr = clientRects[i];
        rects.push({
          x: (cr.left - wrapperRect.left) / wrapperRect.width,
          y: (cr.top - wrapperRect.top) / wrapperRect.height,
          width: cr.width / wrapperRect.width,
          height: cr.height / wrapperRect.height,
        });
      }

      if (rects.length === 0) return;

      const now = new Date().toISOString();
      const annotation: Annotation = {
        id: crypto.randomUUID(),
        filePath,
        page: pageNum,
        type: "highlight",
        color: selectedColor,
        note: "",
        rects,
        selectedText,
        createdAt: now,
        updatedAt: now,
      };

      await saveAnnotation(annotation);
      selection.removeAllRanges();
      onAnnotationsChange();
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [tool, pageNum, filePath, selectedColor, onAnnotationsChange]);

  // Drawing mode mouse handlers (on the wrapper)
  const getRelativePos = (e: React.MouseEvent) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return { x: 0, y: 0 };
    const rect = wrapper.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool !== "draw") return;
    const pos = getRelativePos(e);
    setDrawing(true);
    setDrawStart(pos);
    setDrawCurrent(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing || tool !== "draw") return;
    const pos = getRelativePos(e);
    setDrawCurrent({
      x: Math.min(drawStart.x, pos.x),
      y: Math.min(drawStart.y, pos.y),
      width: Math.abs(pos.x - drawStart.x),
      height: Math.abs(pos.y - drawStart.y),
    });
  };

  const handleMouseUp = async () => {
    if (!drawing || tool !== "draw") return;
    setDrawing(false);
    if (!drawCurrent) return;

    if (drawCurrent.width < 0.005 || drawCurrent.height < 0.005) {
      setDrawCurrent(null);
      return;
    }

    const now = new Date().toISOString();
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      filePath,
      page: pageNum,
      type: "region",
      color: selectedColor,
      note: "",
      region: drawCurrent,
      createdAt: now,
      updatedAt: now,
    };

    await saveAnnotation(annotation);
    setDrawCurrent(null);
    onAnnotationsChange();
  };

  const prevPage = () => setPageNum((p) => Math.max(1, p - 1));
  const nextPage = () => setPageNum((p) => Math.min(numPages, p + 1));
  const zoomIn = () => setScale((s) => Math.min(4, s + 0.25));
  const zoomOut = () => setScale((s) => Math.max(0.5, s - 0.25));

  // Auto-switch page if hovered annotation is on another page (debounced via key change)
  useEffect(() => {
    if (!hoveredAnnotationId) return;
    const ann = annotations.find((a) => a.id === hoveredAnnotationId);
    if (ann && ann.page !== pageNum) {
      setPageNum(ann.page);
    }
  }, [hoveredAnnotationId]);

  const hint =
    tool === "draw"
      ? "Click and drag to draw a region"
      : "Select text to highlight";

  return (
    <div className="viewer-container">
      <div className="viewer-controls">
        <span className="file-name">{fileName}</span>
        <div className="page-controls">
          <button onClick={prevPage} disabled={pageNum <= 1}>
            &larr;
          </button>
          <span>
            {pageNum} / {numPages}
          </span>
          <button onClick={nextPage} disabled={pageNum >= numPages}>
            &rarr;
          </button>
        </div>
        <div className="zoom-controls">
          <button onClick={zoomOut}>-</button>
          <span>{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn}>+</button>
        </div>
        <span className="viewer-hint">{hint}</span>
      </div>
      <div
        className={`viewer-canvas pdf-canvas ${tool === "draw" ? "tool-draw" : ""}`}
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
    </div>
  );
}
