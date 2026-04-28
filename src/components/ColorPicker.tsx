import { HIGHLIGHT_COLORS } from "../types";

interface ColorPickerProps {
  selected: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ selected, onChange }: ColorPickerProps) {
  return (
    <div className="color-picker">
      {HIGHLIGHT_COLORS.map((c) => (
        <button
          key={c.value}
          className={`color-swatch ${selected === c.value ? "active" : ""}`}
          style={{ backgroundColor: c.value }}
          onClick={() => onChange(c.value)}
          title={c.name}
        />
      ))}
    </div>
  );
}
