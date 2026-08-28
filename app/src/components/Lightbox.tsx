import { useEffect, useState } from "react";
import { closeLightbox, getHoveredMedia, openLightbox, subscribeLightbox, type HoveredMedia } from "../lightbox";

export function Lightbox() {
  const [media, setMedia] = useState<HoveredMedia>(null);

  useEffect(() => subscribeLightbox(setMedia), []);

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
        <video src={media.src} controls autoPlay style={{ maxWidth: "90vw", maxHeight: "90vh" }} />
      )}
      {media.nav?.counter && <div style={{ color: "#fff", fontFamily: "serif" }}>{media.nav.counter}</div>}
    </div>
  );
}
