import { useEffect, useRef, useState } from "react";
import { closeLightbox, getHoveredMedia, openLightbox, subscribeLightbox, type HoveredMedia } from "../lightbox";
import { api } from "../api";

export function Lightbox() {
  const [media, setMedia] = useState<HoveredMedia>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const finderSyncedShotRef = useRef<string | null>(null);

  useEffect(() => subscribeLightbox(setMedia), []);

  // Loops within [inSec, outSec] instead of the whole clip when the hovered media
  // (e.g. a trimmed timeline clip) carries custom loop bounds.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !media || media.kind !== "video" || !media.loop) return;
    const { inSec, outSec } = media.loop;
    const seekToIn = () => {
      video.currentTime = inSec;
    };
    const onTimeUpdate = () => {
      if (video.currentTime >= outSec) video.currentTime = inSec;
    };
    video.addEventListener("loadedmetadata", seekToIn);
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      video.removeEventListener("loadedmetadata", seekToIn);
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [media]);

  // "Puppets" the local Finder window: as the timeline preview plays, whichever shot's
  // source image is under the playhead gets selected in Finder, live — only fires the
  // (fairly expensive) osascript call when the active shot actually changes, not per tick.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !media || media.kind !== "video" || !media.finderSync) return;
    const { film, clips } = media.finderSync;
    finderSyncedShotRef.current = null;
    const onTimeUpdate = () => {
      const t = video.currentTime;
      const active = clips.find((c) => t >= c.startSec && t < c.endSec) ?? clips[clips.length - 1];
      if (active && active.shotFilename !== finderSyncedShotRef.current) {
        finderSyncedShotRef.current = active.shotFilename;
        api.syncFinderSelection(film, active.shotFilename).catch(() => {});
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    onTimeUpdate();
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [media]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (media) closeLightbox();
        else openLightbox(getHoveredMedia());
        return;
      }

      if (e.key === "Escape") {
        if (media) {
          e.preventDefault();
          closeLightbox();
        }
        return;
      }

      if (!media) return;
      if (e.key === "ArrowLeft" && media.nav?.onLeft) {
        e.preventDefault();
        media.nav.onLeft();
      } else if (e.key === "ArrowRight" && media.nav?.onRight) {
        e.preventDefault();
        media.nav.onRight();
      } else if (e.key === "ArrowUp" && media.nav?.onUp) {
        e.preventDefault();
        media.nav.onUp();
      } else if (e.key === "ArrowDown" && media.nav?.onDown) {
        e.preventDefault();
        media.nav.onDown();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [media]);

  if (!media) return null;

  return (
    <div
      onClick={() => closeLightbox()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        zIndex: 2000,
      }}
    >
      {media.kind === "image" ? (
        <img src={media.src} style={{ maxWidth: "90vw", maxHeight: "90vh" }} />
      ) : (
        <video
          key={media.src}
          ref={videoRef}
          src={media.src}
          controls
          autoPlay
          loop={!media.loop}
          style={{ maxWidth: "90vw", maxHeight: "90vh" }}
        />
      )}
      {media.nav?.counter && <div style={{ color: "#fff", fontFamily: "serif" }}>{media.nav.counter}</div>}
    </div>
  );
}
