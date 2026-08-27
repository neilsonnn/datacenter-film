import { useEffect, useState } from "react";
import { closeLightbox, getHoveredMedia, openLightbox, subscribeLightbox, type HoveredMedia } from "../lightbox";

export function Lightbox() {
  const [media, setMedia] = useState<HoveredMedia>(null);

  useEffect(() => subscribeLightbox(setMedia), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      e.preventDefault();
      if (media) closeLightbox();
      else openLightbox(getHoveredMedia());
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
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
      }}
    >
      {media.kind === "image" ? (
        <img src={media.src} style={{ maxWidth: "90vw", maxHeight: "90vh" }} />
      ) : (
        <video src={media.src} controls autoPlay style={{ maxWidth: "90vw", maxHeight: "90vh" }} />
      )}
    </div>
  );
}
