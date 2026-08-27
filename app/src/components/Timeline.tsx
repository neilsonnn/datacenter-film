import { useState, type DragEvent } from "react";
import type { FilmState } from "@server/types";

export const TIMELINE_HEIGHT = 190;

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function Timeline({
  film,
  state,
  onReorder,
  onRemoveClip,
  onUpdateSoundtrackIn,
  onExport,
}: {
  film: string;
  state: FilmState;
  onReorder: (clipIds: string[]) => void;
  onRemoveClip: (clipId: string) => void;
  onUpdateSoundtrackIn: (inSec: number) => void;
  onExport: () => Promise<{ filename: string; outputPath: string }>;
}) {
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const clipDurations = state.timeline.map((clip) => {
    const gen = state.shots[clip.shotFilename]?.generations.find((g) => g.id === clip.generationId);
    const inSec = gen?.inSec ?? 0;
    const outSec = gen?.outSec ?? gen?.params.duration ?? 0;
    return Math.max(0, outSec - inSec);
  });
  const totalDuration = clipDurations.reduce((a, b) => a + b, 0);

  function handleDragStart(e: DragEvent<HTMLDivElement>, index: number) {
    e.dataTransfer.setData("text/plain", String(index));
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, dropIndex: number) {
    e.preventDefault();
    const dragIndex = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(dragIndex) || dragIndex === dropIndex) return;
    const reordered = [...state.timeline];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    onReorder(reordered.map((c) => c.id));
  }

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    setExportResult(null);
    try {
      const result = await onExport();
      setExportResult(result.filename);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: TIMELINE_HEIGHT,
        background: "#fff",
        borderTop: "1px solid #000",
        boxSizing: "border-box",
        padding: "0.75rem 1rem",
        display: "flex",
        gap: "1rem",
        fontFamily: "serif",
        zIndex: 500,
      }}
    >
      {state.soundtrack && (
        <div style={{ flexShrink: 0, borderRight: "1px solid #000", paddingRight: "1rem" }}>
          <div style={{ fontSize: "0.8rem", marginBottom: "0.25rem" }}>soundtrack</div>
          <div
            style={{
              maxWidth: 140,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: "0.75rem",
              marginBottom: "0.25rem",
            }}
          >
            {state.soundtrack.filename}
          </div>
          <label style={{ fontSize: "0.75rem" }}>
            in (s){" "}
            <input
              type="number"
              min={0}
              defaultValue={state.soundtrack.inSec}
              style={{ width: 60 }}
              onBlur={(e) => onUpdateSoundtrackIn(Number(e.target.value))}
            />
          </label>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, display: "flex", gap: "0.5rem", overflowX: "auto" }}>
        {state.timeline.length === 0 && (
          <p style={{ color: "#666", fontSize: "0.85rem" }}>
            No clips yet — hit "Add to Timeline" on a shot's output to add it here.
          </p>
        )}
        {state.timeline.map((clip, i) => {
          const gen = state.shots[clip.shotFilename]?.generations.find((g) => g.id === clip.generationId);
          const inSec = gen?.inSec ?? 0;
          const outSec = gen?.outSec ?? gen?.params.duration ?? 0;
          return (
            <div
              key={clip.id}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, i)}
              style={{
                flexShrink: 0,
                width: 110,
                border: "1px solid #000",
                borderRadius: 0,
                padding: "0.25rem",
                cursor: "grab",
                position: "relative",
                background: "#fff",
              }}
            >
              <button
                onClick={() => onRemoveClip(clip.id)}
                title="remove from timeline"
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  padding: "0 0.25rem",
                  fontSize: "0.7rem",
                  lineHeight: 1.4,
                }}
              >
                x
              </button>
              <img
                src={`/films/${film}/${clip.shotFilename}`}
                alt={clip.shotFilename}
                style={{ width: "100%", height: 55, objectFit: "cover", display: "block" }}
              />
              <div
                style={{
                  fontSize: "0.65rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginTop: "0.15rem",
                }}
                title={clip.shotFilename}
              >
                {clip.shotFilename}
              </div>
              <div style={{ fontSize: "0.65rem", color: "#666" }}>
                {formatTime(inSec)}–{formatTime(outSec)}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ flexShrink: 0, borderLeft: "1px solid #000", paddingLeft: "1rem", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ fontSize: "0.8rem" }}>total: {formatTime(totalDuration)}</div>
        <button onClick={handleExport} disabled={exporting || state.timeline.length === 0}>
          {exporting ? "exporting..." : "Export"}
        </button>
        {exportResult && <div style={{ fontSize: "0.7rem", color: "#070" }}>saved {exportResult}</div>}
        {exportError && <div style={{ fontSize: "0.7rem", color: "red", maxWidth: 160 }}>{exportError}</div>}
      </div>
    </div>
  );
}
