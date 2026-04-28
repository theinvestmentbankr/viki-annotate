export interface Annotation {
  id: string;
  filePath: string;
  page: number;
  type: "highlight" | "region";
  color: string;
  note: string;
  // For text highlights (PDF)
  rects?: AnnotationRect[];
  selectedText?: string;
  // For region annotations (images)
  region?: { x: number; y: number; width: number; height: number };
  createdAt: string;
  updatedAt: string;
}

export interface AnnotationRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#ffeb3b" },
  { name: "Green", value: "#69f0ae" },
  { name: "Blue", value: "#40c4ff" },
  { name: "Pink", value: "#ff80ab" },
  { name: "Orange", value: "#ffab40" },
  { name: "Purple", value: "#b388ff" },
];
