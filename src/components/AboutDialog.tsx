interface AboutDialogProps {
  onClose: () => void;
}

export default function AboutDialog({ onClose }: AboutDialogProps) {
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Viki Annotate</h2>
        <p className="about-version">Version 0.1.0</p>
        <p className="about-description">
          A desktop application for annotating PDFs and images with highlights,
          notes, and searchable annotations.
        </p>
        <p className="about-description">
          Built with Tauri, React, and TypeScript.
        </p>
        <p className="about-credit">Made for Viktoria.</p>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
