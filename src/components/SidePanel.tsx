import { useState, useEffect, useRef } from "react";
import type { Annotation } from "../types";
import { saveAnnotation, deleteAnnotation } from "../db";

interface SidePanelProps {
  annotations: Annotation[];
  onAnnotationsChange: () => void;
  onAnnotationClick: (annotation: Annotation) => void;
  onHoverAnnotation: (id: string | null) => void;
  hoveredAnnotationId: string | null;
  selectedAnnotation: Annotation | null;
}

function linkify(text: string): (string | { href: string; text: string })[] {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const parts: (string | { href: string; text: string })[] = [];
  let lastIndex = 0;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push({ href: match[1], text: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

export default function SidePanel({
  annotations,
  onAnnotationsChange,
  onAnnotationClick,
  onHoverAnnotation,
  hoveredAnnotationId,
  selectedAnnotation,
}: SidePanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll hovered card into view
  useEffect(() => {
    if (!hoveredAnnotationId) return;
    const card = cardRefs.current.get(hoveredAnnotationId);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [hoveredAnnotationId]);

  const startEdit = (ann: Annotation) => {
    setEditingId(ann.id);
    setEditText(ann.note);
  };

  const saveEdit = async (ann: Annotation) => {
    await saveAnnotation({
      ...ann,
      note: editText,
      updatedAt: new Date().toISOString(),
    });
    setEditingId(null);
    onAnnotationsChange();
  };

  const handleDelete = async (id: string) => {
    await deleteAnnotation(id);
    onAnnotationsChange();
  };

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <h2>Annotations</h2>
        <span className="annotation-count">{annotations.length}</span>
      </div>
      <div className="side-panel-list">
        {annotations.length === 0 && (
          <p className="side-panel-empty">
            No annotations yet. Select text or draw a region to create one.
          </p>
        )}
        {annotations.map((ann) => (
          <div
            key={ann.id}
            ref={(el) => {
              if (el) cardRefs.current.set(ann.id, el);
              else cardRefs.current.delete(ann.id);
            }}
            className={`annotation-card ${
              selectedAnnotation?.id === ann.id ? "selected" : ""
            } ${hoveredAnnotationId === ann.id ? "hovered" : ""}`}
            onClick={() => onAnnotationClick(ann)}
            onMouseEnter={() => onHoverAnnotation(ann.id)}
            onMouseLeave={() => onHoverAnnotation(null)}
          >
            <div className="annotation-card-header">
              <span
                className="annotation-color-dot"
                style={{ backgroundColor: ann.color }}
              />
              <span className="annotation-page">Page {ann.page}</span>
              <button
                className="annotation-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(ann.id);
                }}
                title="Delete"
              >
                &times;
              </button>
            </div>
            {ann.selectedText && (
              <p className="annotation-text">"{ann.selectedText}"</p>
            )}
            {editingId === ann.id ? (
              <div className="annotation-edit">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="Add a note..."
                  autoFocus
                  rows={3}
                />
                <div className="annotation-edit-actions">
                  <button onClick={() => saveEdit(ann)}>Save</button>
                  <button onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div
                className="annotation-note"
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(ann);
                }}
              >
                {ann.note ? (
                  <p>
                    {linkify(ann.note).map((part, i) =>
                      typeof part === "string" ? (
                        <span key={i}>{part}</span>
                      ) : (
                        <a
                          key={i}
                          href={part.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {part.text}
                        </a>
                      )
                    )}
                  </p>
                ) : (
                  <p className="annotation-note-placeholder">
                    Click to add a note...
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
