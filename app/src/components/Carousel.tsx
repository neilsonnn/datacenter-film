import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { Generation } from "@server/types";
import { setHoveredMedia, type LightboxNav } from "../lightbox";

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface DragState {
  startFrac: number;
  currentFrac: number;
}

export function Carousel({
  film,
  generation,
  width,
  height,
  onTrimChange,
  nav,
}: {
  film: string;
  generation: Generation | null;
  width: number;
  height: number;
  onTrimChange: (inSec: number, outSec: number) => void;
  nav?: LightboxNav;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const draggedRef = useRef(false);
  const [hovering, setHovering] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);

  const totalDuration = generation?.params.duration ?? 0;
  const committedIn = generation?.inSec ?? 0;
  const committedOut = generation?.outSec ?? totalDuration;
  const liveIn = drag ? Math.min(drag.startFrac, drag.currentFrac) * totalDuration : committedIn;
  const liveOut = drag ? Math.max(drag.startFrac, drag.currentFrac) * totalDuration : committedOut;

  useEffect(() => {
    if (!drag || !generation) return;

    function onMove(e: globalThis.MouseEvent) {
      const rect = rectRef.current;
      if (!rect) return;
      const frac = clamp01((e.clientX - rect.left) / rect.width);
      setDrag((d) => (d ? { ...d, currentFrac: frac } : d));
      const video = videoRef.current;
      if (video && totalDuration > 0) video.currentTime = frac * totalDuration;
    }

    function onUp() {
      setDrag((d) => {
        if (d && generation) {
          const a = d.startFrac * totalDuration;
          const b = d.currentFrac * totalDuration;
          const inSec = Math.min(a, b);
          const outSec = Math.max(a, b);
          if (outSec - inSec > 0.15) {
            draggedRef.current = true;
            onTrimChange(inSec, outSec);
          }
        }
        return null;
      });
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null, generation, totalDuration]);

  function handleMouseDown(e: MouseEvent<HTMLVideoElement>) {
    if (!generation) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    rectRef.current = rect;
    const frac = clamp01((e.clientX - rect.left) / rect.width);
    setDrag({ startFrac: frac, currentFrac: frac });
  }

  function handleMouseMove(e: MouseEvent<HTMLVideoElement>) {
    if (drag) return; // handled by the window-level listener while dragging
    const video = videoRef.current;
    if (!video || !isFinite(video.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = clamp01((e.clientX - rect.left) / rect.width);
    video.currentTime = fraction * video.duration;
  }

  function handleClick() {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }

  return (
    <div style={{ width, flexShrink: 0 }}>
      <div
        style={{
          border: "1px solid #000",
          borderRadius: 0,
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {!generation && <p style={{ color: "#666" }}>no output yet</p>}
        {generation?.status === "completed" && generation.videoFilename && (
          <video
            key={generation.videoFilename}
            ref={videoRef}
            autoPlay
            loop
            playsInline
            muted={!hovering}
            onMouseEnter={() => {
              setHovering(true);
              setHoveredMedia({ kind: "video", src: `/films/${film}/${generation.videoFilename}`, nav });
            }}
            onMouseLeave={() => setHovering(false)}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onClick={handleClick}
            style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
            src={`/films/${film}/${generation.videoFilename}`}
          />
        )}
        {generation && (generation.status === "queued" || generation.status === "in_progress") && (
          <p>status: {generation.status}</p>
        )}
        {generation?.status === "error" && <p style={{ color: "red" }}>error: {generation.error}</p>}
      </div>

      <div style={{ marginTop: "0.25rem" }}>
        <div style={{ position: "relative", height: 6, background: "#eee", border: "1px solid #000" }}>
          {totalDuration > 0 && (
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${(liveIn / totalDuration) * 100}%`,
                width: `${((liveOut - liveIn) / totalDuration) * 100}%`,
                background: "#000",
              }}
            />
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem" }}>
          <span>{totalDuration > 0 ? formatTime(liveIn) : "-:--"}</span>
          <span>
            {totalDuration > 0 ? `${formatTime(liveOut)} / ${formatTime(totalDuration)}` : "-:-- / -:--"}
          </span>
        </div>
      </div>
    </div>
  );
}
