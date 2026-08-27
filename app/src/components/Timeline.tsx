import { useState, type DragEvent } from "react";
import type { FilmStateResponse } from "@server/types";
import { hoverableMedia } from "../lightbox";

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
  onToggleClipMute,
  onSelectSoundtrack,
  onUpdateSoundtrackIn,
  onExport,
  onPreview,
}: {
  film: string;
  state: FilmStateResponse;
  onReorder: (clipIds: string[]) => void;
  onRemoveClip: (clipId: string) => void;
  onToggleClipMute: (clipId: string, muted: boolean) => void;
  onSelectSoundtrack: (filename: string | null) => void;
  onUpdateSoundtrackIn: (inSec: number) => void;
  onExport: () => Promise<{ filename: string; outputPath: string }>;
  onPreview: () => Promise<{ filename: string; outputPath: string }>;
}) {
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

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

  async function handlePreview() {
    setPreviewing(true);
    setPreviewError(null);
    try {
      const result = await onPreview();
      // preview.mp4 is overwritten in place each time — cache-bust so the <video> reloads the new bytes.
      setPreviewSrc(`/films/${film}/${result.filename}?t=${Date.now()}`);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewing(false);
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
      <div style={{ flexShrink: 0, borderRight: "1px solid #000", paddingRight: "1rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {previewSrc ? (
          <video
            key={previewSrc}
            src={previewSrc}
            autoPlay
            playsInline
            {...hoverableMedia({ kind: "video", src: previewSrc })}
            style={{ width: 140, height: 79, background: "#000" }}
          />
        ) : (
          <div style={{ width: 140, height: 79, background: "#000", color: "#999", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem" }}>
            no preview yet
          </div>
        )}
        <button onClick={handlePreview} disabled={previewing || state.timeline.length === 0} style={{ marginTop: "0.25rem", width: "100%" }}>
          {previewing ? "rendering..." : "Preview"}
        </button>
        {previewError && <div style={{ fontSize: "0.65rem", color: "red", maxWidth: 140 }}>{previewError}</div>}
      </div>

      <div style={{ flexShrink: 0, borderRight: "1px solid #000", paddingRight: "1rem" }}>
        <div style={{ fontSize: "0.8rem", marginBottom: "0.25rem" }}>soundtrack</div>
        <select
          value={state.soundtrack?.filename ?? ""}
          onChange={(e) => onSelectSoundtrack(e.target.value || null)}
          style={{ maxWidth: 140, marginBottom: "0.25rem", display: "block" }}
        >
          <option value="">None</option>
          {state.audioFiles.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        {state.soundtrack && (
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
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", gap: "0.5rem", overflowX: "auto" }}>
        {state.timeline.length === 0 && (
          <p style={{ color: "#666", fontSize: "0.85rem" }}>
            No clips yet — hit "+" on a shot's output to add it here.
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
              <button
                onClick={() => onToggleClipMute(clip.id, !clip.muted)}
                title={clip.muted ? "unmute this clip" : "mute this clip"}
                style={{
                  position: "absolute",
                  top: 2,
                  left: 2,
                  padding: "0 0.25rem",
                  fontSize: "0.7rem",
                  lineHeight: 1.4,
                  borderColor: clip.muted ? "#c00" : undefined,
                  background: clip.muted ? "#ffe6e6" : undefined,
                  color: clip.muted ? "#c00" : undefined,
                }}
              >
                {clip.muted ? "M" : "m"}
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
