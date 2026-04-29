# Viki Annotate

A lightweight desktop application for annotating PDFs and images with highlights, drawings, and searchable notes.

> **Dedicated to my girlfriend Viktoria.**

## Features

- **Open PDFs and images** — PDF, PNG, JPG, JPEG, TIFF, BMP, GIF, WebP
- **Two annotation modes for PDFs**
  - **Highlight** — select text to highlight a passage
  - **Draw** — click and drag to mark a freeform region, just like Paint
- **Region annotations on images** — drag to mark any area
- **Multi-color picker** — six annotation colors
- **Side-note panel** with editable notes per annotation
- **Bidirectional hover-link** — hover an annotation in the document to see its note (and vice versa) — auto-scrolls and auto-jumps to the right page
- **Clickable hyperlinks** — URLs in notes open in the default browser
- **Search** — filter annotations by note text or highlighted text
- **Export**
  - Annotated PDF (highlights baked in)
  - Markdown notes
- **Local storage** — all annotations stored locally via SQLite, no account required

## Tech Stack

- [Tauri](https://tauri.app/) v2 — Rust-backed desktop shell
- [React](https://react.dev/) 19 + TypeScript
- [Vite](https://vitejs.dev/) 8 — build tool
- [PDF.js](https://mozilla.github.io/pdf.js/) — PDF rendering
- [pdf-lib](https://pdf-lib.js.org/) — PDF export with annotations
- SQLite via `tauri-plugin-sql` — annotation persistence

App size: ~13 MB (vs ~150 MB for an equivalent Electron app).

## Download

Pre-built macOS app bundles are available on the [Releases](../../releases) page.

### Installing on macOS

The build is ad-hoc signed but **not notarized by Apple** (notarization requires a paid Apple Developer ID, which this project does not yet have). After downloading, macOS may show one of two warnings the first time you open the app:

- *"Viki Annotate cannot be opened because the developer cannot be verified"* — **right-click the app and choose Open**, then click *Open* in the dialog. macOS will remember this choice.
- *"Viki Annotate is damaged and can't be opened"* — this happens when macOS strips the bundle's signature on download. Run the following in Terminal once after moving the app to `/Applications`:
  ```bash
  xattr -cr "/Applications/Viki Annotate.app"
  ```
  Then double-click the app normally.

## Build From Source

Requires [Node.js](https://nodejs.org/) 20+ and [Rust](https://www.rust-lang.org/tools/install).

```bash
npm install
npm run tauri dev      # development
npm run tauri build    # production bundle
```

The production bundle is written to `src-tauri/target/release/bundle/`.

## Project Layout

```
viki-annotate/
├── src/                    React + TypeScript frontend
│   ├── App.tsx             Main app shell
│   ├── components/
│   │   ├── PdfViewer.tsx   PDF.js viewer with text + region annotations
│   │   ├── ImageViewer.tsx Image viewer with region annotations
│   │   ├── SidePanel.tsx   Annotation list with notes
│   │   ├── ColorPicker.tsx Color palette
│   │   └── AboutDialog.tsx About modal
│   ├── db.ts               SQLite annotation persistence
│   ├── export.ts           PDF + Markdown export
│   └── types.ts            Shared types
└── src-tauri/              Rust backend (Tauri v2)
    ├── src/lib.rs          Plugin setup
    ├── Cargo.toml          Rust dependencies
    └── tauri.conf.json     App config
```

## License

[Apache License 2.0](LICENSE)
