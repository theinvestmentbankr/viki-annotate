import { useState, useCallback, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import PdfViewer from "./components/PdfViewer";
import type { Tool } from "./components/PdfViewer";
import ImageViewer from "./components/ImageViewer";
import ColorPicker from "./components/ColorPicker";
import SidePanel from "./components/SidePanel";
import AboutDialog from "./components/AboutDialog";
import { getAnnotationsForFile } from "./db";
import { exportAnnotatedPdf, exportMarkdown } from "./export";
import type { Annotation } from "./types";
import { HIGHLIGHT_COLORS } from "./types";

type FileType = "pdf" | "image" | null;

interface OpenFile {
  name: string;
  path: string;
  data: Uint8Array;
  type: FileType;
}

function getFileType(path: string): FileType {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (
    ["png", "jpg", "jpeg", "tiff", "tif", "bmp", "gif", "webp"].includes(
      ext ?? ""
    )
  )
    return "image";
  return null;
}

function App() {
  const [file, setFile] = useState<OpenFile | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0].value);
  const [showPanel, setShowPanel] = useState(true);
  const [selectedAnnotation, setSelectedAnnotation] =
    useState<Annotation | null>(null);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Annotation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [tool, setTool] = useState<Tool>("highlight");

  const loadAnnotations = useCallback(async () => {
    if (!file) return;
    const anns = await getAnnotationsForFile(file.path);
    setAnnotations(anns);
  }, [file]);

  useEffect(() => {
    loadAnnotations();
  }, [loadAnnotations]);

  const openFile = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Documents",
          extensions: [
            "pdf",
            "png",
            "jpg",
            "jpeg",
            "tiff",
            "tif",
            "bmp",
            "gif",
            "webp",
          ],
        },
      ],
    });
    if (!selected) return;

    const filePath = typeof selected === "string" ? selected : selected;
    const data = await readFile(filePath);
    const name = filePath.split("/").pop() ?? filePath;
    const type = getFileType(filePath);

    setFile({ name, path: filePath, data, type });
    setSelectedAnnotation(null);
    setHoveredAnnotationId(null);
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
  }, []);

  const handleAnnotationClick = useCallback((ann: Annotation) => {
    setSelectedAnnotation(ann);
    setShowPanel(true);
  }, []);

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const q = searchQuery.toLowerCase();
    const results = annotations.filter(
      (a) =>
        a.note.toLowerCase().includes(q) ||
        (a.selectedText && a.selectedText.toLowerCase().includes(q))
    );
    setSearchResults(results);
  }, [searchQuery, annotations]);

  useEffect(() => {
    const timer = setTimeout(handleSearch, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const displayAnnotations = isSearching ? searchResults : annotations;

  return (
    <div className="app">
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
      <header className="toolbar">
        <h1 className="app-title" onClick={() => setShowAbout(true)}>
          Viki Annotate
        </h1>
        <button className="btn" onClick={openFile}>
          Open File
        </button>
        {file && (
          <>
            {file.type === "pdf" && (
              <div className="tool-toggle">
                <button
                  className={`tool-btn ${tool === "highlight" ? "active" : ""}`}
                  onClick={() => setTool("highlight")}
                  title="Select text to highlight"
                >
                  Highlight
                </button>
                <button
                  className={`tool-btn ${tool === "draw" ? "active" : ""}`}
                  onClick={() => setTool("draw")}
                  title="Click and drag to draw a region"
                >
                  Draw
                </button>
              </div>
            )}
            <ColorPicker selected={selectedColor} onChange={setSelectedColor} />
            <div className="search-box">
              <input
                type="text"
                placeholder="Search annotations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {file.type === "pdf" && annotations.length > 0 && (
              <button
                className="btn btn-secondary"
                onClick={() =>
                  exportAnnotatedPdf(file.data, annotations, file.name)
                }
              >
                Export PDF
              </button>
            )}
            {annotations.length > 0 && (
              <button
                className="btn btn-secondary"
                onClick={() => exportMarkdown(annotations, file.name)}
              >
                Export Notes
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => setShowPanel(!showPanel)}
            >
              {showPanel ? "Hide Panel" : "Show Panel"}
            </button>
          </>
        )}
      </header>
      <div className="main-content">
        <main className="workspace">
          {!file && (
            <div className="welcome-screen">
              <h2 className="welcome-title">Viki Annotate</h2>
              <p className="welcome-subtitle">
                Open a PDF or image to get started
              </p>
              <div className="welcome-instructions">
                <div className="welcome-card">
                  <span className="welcome-icon">PDF</span>
                  <p>Highlight text or draw regions to annotate</p>
                </div>
                <div className="welcome-card">
                  <span className="welcome-icon">IMG</span>
                  <p>Click and drag to mark a region</p>
                </div>
              </div>
              <button className="btn welcome-open-btn" onClick={openFile}>
                Open File
              </button>
            </div>
          )}
          {file?.type === "pdf" && (
            <PdfViewer
              fileData={file.data}
              fileName={file.name}
              filePath={file.path}
              annotations={annotations}
              onAnnotationsChange={loadAnnotations}
              onAnnotationClick={handleAnnotationClick}
              onHoverAnnotation={setHoveredAnnotationId}
              hoveredAnnotationId={hoveredAnnotationId}
              selectedColor={selectedColor}
              tool={tool}
            />
          )}
          {file?.type === "image" && (
            <ImageViewer
              fileData={file.data}
              fileName={file.name}
              filePath={file.path}
              annotations={annotations}
              onAnnotationsChange={loadAnnotations}
              onAnnotationClick={handleAnnotationClick}
              onHoverAnnotation={setHoveredAnnotationId}
              hoveredAnnotationId={hoveredAnnotationId}
              selectedColor={selectedColor}
            />
          )}
          {file && !file.type && (
            <p className="welcome">Unsupported file type.</p>
          )}
        </main>
        {file && showPanel && (
          <SidePanel
            annotations={displayAnnotations}
            onAnnotationsChange={loadAnnotations}
            onAnnotationClick={handleAnnotationClick}
            onHoverAnnotation={setHoveredAnnotationId}
            hoveredAnnotationId={hoveredAnnotationId}
            selectedAnnotation={selectedAnnotation}
          />
        )}
      </div>
    </div>
  );
}

export default App;
