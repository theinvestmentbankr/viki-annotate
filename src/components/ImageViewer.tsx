import { useRef, useState, useCallback } from "react";
import type { Annotation } from "../types";
import { saveAnnotation } from "../db";

interface ImageViewerProps {
  fileData: Uint8Array;
  fileName: string;
  filePath: string;
  annotations: Annotation[];
  onAnnotationsChange: () => void;
  onAnnotationClick: (annotation: Annotation) => void;
  onHoverAnnotation: (id: string | null) => void;
  hoveredAnnotationId: string | null;
  selectedColor: string;
}

export default function ImageViewer({
  fileData,
  fileName,
  filePath,
  annotations,
  onAnnotationsChange,
  onAnnotationClick,
  onHoverAnnotation,
  hoveredAnnotationId,
  selectedColor,
}: ImageViewerProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const src = URL.createObjectURL(
    new Blob([fileData.buffer as ArrayBuffer])
  );

  const getRelativePos = useCallback(
    (e: React.MouseEvent) => {
      const img = imgRef.current;
      if (!img) return { x: 0, y: 0 };
      const rect = img.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    },
    []
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getRelativePos(e);
    setDrawing(true);
    setStartPos(pos);
    setCurrentRect(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing) return;
    const pos = getRelativePos(e);
    setCurrentRect({
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      width: Math.abs(pos.x - startPos.x),
      height: Math.abs(pos.y - startPos.y),
    });
  };

  const handleMouseUp = async () => {
    if (!drawing || !currentRect) {
      setDrawing(false);
      return;
    }
    setDrawing(false);

    if (currentRect.width < 0.01 || currentRect.height < 0.01) {
      setCurrentRect(null);
      return;
    }

    const now = new Date().toISOString();
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      filePath,
      page: 1,
      type: "region",
      color: selectedColor,
      note: "",
      region: currentRect,
      createdAt: now,
      updatedAt: now,
    };

    await saveAnnotation(annotation);
    setCurrentRect(null);
    onAnnotationsChange();
  };

  return (
    <div className="viewer-container">
      <div className="viewer-controls">
        <span className="file-name">{fileName}</span>
        <span className="viewer-hint">Click and drag to mark a region</span>
      </div>
      <div className="viewer-canvas image-viewer-scroll">
        <div
          className="image-annotation-wrapper"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <img
            ref={imgRef}
            src={src}
            alt={fileName}
            className="image-content"
            draggable={false}
          />
          {/* Existing annotations */}
          {annotations
            .filter((a) => a.region)
            .map((ann) => (
              <div
                key={ann.id}
                className={`image-region-overlay ${
                  hoveredAnnotationId === ann.id ? "hovered" : ""
                }`}
                style={{
                  left: `${ann.region!.x * 100}%`,
                  top: `${ann.region!.y * 100}%`,
                  width: `${ann.region!.width * 100}%`,
                  height: `${ann.region!.height * 100}%`,
                  borderColor: ann.color,
                  backgroundColor: `${ann.color}33`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onAnnotationClick(ann);
                }}
                onMouseEnter={() => onHoverAnnotation(ann.id)}
                onMouseLeave={() => onHoverAnnotation(null)}
              />
            ))}
          {/* Drawing rect */}
          {currentRect && (
            <div
              className="image-region-overlay drawing"
              style={{
                left: `${currentRect.x * 100}%`,
                top: `${currentRect.y * 100}%`,
                width: `${currentRect.width * 100}%`,
                height: `${currentRect.height * 100}%`,
                borderColor: selectedColor,
                backgroundColor: `${selectedColor}33`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
