import { useRef, useState, type MouseEvent } from "react";
import type { Generation } from "@server/types";

export function Carousel({
  film,
  generation,
  width,
  height,
}: {
  film: string;
  generation: Generation | null;
  width: number;
  height: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovering, setHovering] = useState(false);

  function handleMouseMove(e: MouseEvent<HTMLVideoElement>) {
    const video = videoRef.current;
    if (!video || !isFinite(video.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    video.currentTime = fraction * video.duration;
  }

  function handleClick() {
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
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
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
    </div>
  );
}
