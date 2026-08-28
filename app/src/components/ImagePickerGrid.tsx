import { useEffect, useRef } from "react";

export function ImagePickerGrid({
  film,
  images,
  selected,
  onSelect,
  height,
}: {
  film: string;
  images: string[];
  selected: string | null;
  onSelect: (filename: string | null) => void;
  height: number;
}) {
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (!selected) return;
    buttonRefs.current.get(selected)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selected]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "0.25rem",
        alignContent: "flex-start",
        height,
        overflowY: "auto",
      }}
    >
      {images.map((filename) => (
        <button
          key={filename}
          ref={(el) => {
            if (el) buttonRefs.current.set(filename, el);
            else buttonRefs.current.delete(filename);
          }}
          onClick={() => onSelect(selected === filename ? null : filename)}
          title={filename}
          style={{
            padding: 0,
            border: "1px solid #000",
            borderRadius: 0,
            borderWidth: selected === filename ? 3 : 1,
            borderColor: selected === filename ? "#0a0" : "#000",
            aspectRatio: "1",
            background: "none",
          }}
        >
          <img
            src={`/films/${film}/${filename}`}
            alt={filename}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </button>
      ))}
    </div>
  );
}
