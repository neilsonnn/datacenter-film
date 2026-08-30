import { useState, type DragEvent } from "react";
import type { AspectRatio, FilmStateResponse } from "@server/types";
import { AudioFxPanel } from "./AudioFxPanel";
import { scrollToShot } from "./ShotNav";
import { hoverableMedia, openLightbox, type FinderSyncClip, type LightboxNav } from "../lightbox";
import { selectShotGeneration } from "../shotRegistry";

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
  onUpdateAudioFx,
  onUpdateAspectRatio,
  onExport,
  onPreview,
  onRevealExport,
}: {
  film: string;
  state: FilmStateResponse;
  onReorder: (clipIds: string[]) => void;
  onRemoveClip: (clipId: string) => void;
  onToggleClipMute: (clipId: string, muted: boolean) => void;
  onSelectSoundtrack: (filename: string | null) => void;
  onUpdateSoundtrackIn: (inSec: number) => void;
  onUpdateAudioFx: (patch: { reverb?: number; lowpassHz?: number | null; clipsOnly?: boolean }) => void;
  onUpdateAspectRatio: (aspectRatio: AspectRatio) => void;
  onExport: () => Promise<{ filename: string; outputPath: string }>;
  onPreview: () => Promise<{ filename: string; outputPath: string }>;
  onRevealExport: (filename: string) => void;
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

  // Maps the preview render's playhead position back to "which shot is on screen right
  // now" — same clip order/durations the export pipeline actually cut the video with.
  function finderSyncClips(): FinderSyncClip[] {
    let acc = 0;
    return state.timeline.map((clip, i) => {
      const startSec = acc;
      acc += clipDurations[i];
      return { shotFilename: clip.shotFilename, startSec, endSec: acc };
    });
  }

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
    setPreviewSrc(null); // clear the stale preview immediately, don't wait for the new render
    try {
      const result = await onPreview();
      // preview.mp4 is overwritten in place each time — cache-bust so the <video> reloads the new bytes.
      const src = `/films/${film}/${result.filename}?t=${Date.now()}`;
      setPreviewSrc(src);
      openLightbox({ kind: "video", src, finderSync: { film, clips: finderSyncClips() } });
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewing(false);
    }
  }

  function clipMedia(index: number) {
    const clip = state.timeline[index];
    const gen = clip ? state.shots[clip.shotFilename]?.generations.find((g) => g.id === clip.generationId) : undefined;
    if (!gen?.videoFilename) return null;
    const inSec = gen.inSec ?? 0;
    const outSec = gen.outSec ?? gen.params.duration;
    return { src: `/films/${film}/${gen.videoFilename}`, inSec, outSec };
  }

  function clipNav(index: number): LightboxNav {
    return {
      counter: `${index + 1} / ${state.timeline.length}`,
      onLeft: index > 0 ? () => openClipInLightbox(index - 1) : undefined,
      onRight: index < state.timeline.length - 1 ? () => openClipInLightbox(index + 1) : undefined,
    };
  }

  function openClipInLightbox(index: number) {
    const media = clipMedia(index);
    if (!media) return;
    openLightbox({
      kind: "video",
      src: media.src,
      loop: { inSec: media.inSec, outSec: media.outSec },
      nav: clipNav(index),
    });
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
      <div style={{ flexShrink: 0, borderRight: "1px solid #000", paddingRight: "1rem", width: 170, fontSize: "0.75rem", overflowY: "auto" }}>
        <select
          value={state.soundtrack?.filename ?? ""}
          onChange={(e) => onSelectSoundtrack(e.target.value || null)}
          style={{ width: "100%", marginBottom: "0.25rem", display: "block" }}
        >
          <option value="">None</option>
          {state.audioFiles.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        {state.soundtrack && (
          <label style={{ display: "block", marginBottom: "0.25rem" }}>
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
        <AudioFxPanel audioFx={state.audioFx} onChange={onUpdateAudioFx} />
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
          const media = clipMedia(i);
          return (
            <div
              key={clip.id}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, i)}
              onClick={() => {
                scrollToShot(clip.shotFilename);
                selectShotGeneration(clip.shotFilename, clip.generationId);
              }}
              {...(media
                ? hoverableMedia({
                    kind: "video",
                    src: media.src,
                    loop: { inSec: media.inSec, outSec: media.outSec },
                    nav: clipNav(i),
                  })
                : {})}
              style={{
                flex: "1 1 0",
                minWidth: 40,
                maxWidth: 110,
                border: "1px solid #000",
                borderRadius: 0,
                padding: "0.25rem",
                cursor: "grab",
                position: "relative",
                background: "#fff",
              }}
            >
              <div style={{ position: "absolute", bottom: 2, left: 2, display: "flex", gap: 2 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleClipMute(clip.id, !clip.muted);
                  }}
                  title={clip.muted ? "unmute this clip" : "mute this clip"}
                  style={{
                    padding: "0 0.25rem",
                    fontSize: "0.7rem",
                    lineHeight: 1.4,
                    background: "#fff",
                    borderColor: clip.muted ? "#c00" : undefined,
                    color: clip.muted ? "#c00" : undefined,
                  }}
                >
                  {clip.muted ? "M" : "m"}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveClip(clip.id);
                  }}
                  title="remove from timeline"
                  style={{ padding: "0 0.25rem", fontSize: "0.7rem", lineHeight: 1.4, background: "#fff" }}
                >
                  x
                </button>
              </div>
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

      <div style={{ flexShrink: 0, borderLeft: "1px solid #000", paddingLeft: "1rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
        <select
          value={state.aspectRatio}
          onChange={(e) => onUpdateAspectRatio(e.target.value as AspectRatio)}
          style={{ width: "100%" }}
        >
          <option value="landscape">16:9 landscape</option>
          <option value="square">1:1 square</option>
          <option value="portrait">9:16 portrait</option>
        </select>
        <div style={{ display: "flex", gap: "0.25rem", width: "100%" }}>
          <button onClick={handlePreview} disabled={previewing || state.timeline.length === 0} style={{ flex: 1 }}>
            {previewing ? "rendering..." : "Preview"}
          </button>
          <button
            onClick={() =>
              previewSrc &&
              openLightbox({ kind: "video", src: previewSrc, finderSync: { film, clips: finderSyncClips() } })
            }
            disabled={!previewSrc}
            title="open last preview"
          >
            Open
          </button>
        </div>
        {previewError && <div style={{ fontSize: "0.65rem", color: "red", maxWidth: 120 }}>{previewError}</div>}

        <div style={{ fontSize: "0.8rem" }}>total: {formatTime(totalDuration)}</div>
        <div style={{ display: "flex", gap: "0.25rem", width: "100%" }}>
          <button onClick={handleExport} disabled={exporting || state.timeline.length === 0} style={{ flex: 1 }}>
            {exporting ? "exporting..." : "Export"}
          </button>
          <button
            onClick={() => exportResult && onRevealExport(exportResult)}
            disabled={!exportResult}
            title="reveal exported file in file manager"
          >
            Open
          </button>
        </div>
        {exportResult && <div style={{ fontSize: "0.7rem", color: "#070" }}>saved {exportResult}</div>}
        {exportError && <div style={{ fontSize: "0.7rem", color: "red", maxWidth: 120 }}>{exportError}</div>}
      </div>
    </div>
  );
}
