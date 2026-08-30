export interface LightboxNav {
  /** Shown only for left/right (generation) navigation, e.g. "2 / 5". No readout for up/down. */
  counter?: string;
  onLeft?: () => void;
  onRight?: () => void;
  onUp?: () => void;
  onDown?: () => void;
}

/** One segment of the global timeline, in playback order, for live Finder-selection sync. */
export interface FinderSyncClip {
  shotFilename: string;
  startSec: number;
  endSec: number;
}

export type HoveredMedia =
  | {
      kind: "image" | "video";
      src: string;
      nav?: LightboxNav;
      loop?: { inSec: number; outSec: number };
      /** While set, playback drives the local Finder window's selection to match whichever
       * shot's source image is "on screen" at the current playhead position. macOS only. */
      finderSync?: { film: string; clips: FinderSyncClip[] };
    }
  | null;

let current: HoveredMedia = null;

export function setHoveredMedia(media: HoveredMedia): void {
  current = media;
}

export function getHoveredMedia(): HoveredMedia {
  return current;
}

// Lets any component (not just the spacebar handler) open/close the lightbox directly,
// e.g. jumping straight to it once a preview render finishes.
type OpenListener = (media: HoveredMedia) => void;
let openMedia: HoveredMedia = null;
const openListeners = new Set<OpenListener>();

export function openLightbox(media: HoveredMedia): void {
  openMedia = media;
  openListeners.forEach((l) => l(openMedia));
}

export function closeLightbox(): void {
  openMedia = null;
  openListeners.forEach((l) => l(openMedia));
}

export function subscribeLightbox(listener: OpenListener): () => void {
  openListeners.add(listener);
  return () => openListeners.delete(listener);
}

/**
 * Spread onto an element to make it hover-trackable for the spacebar lightbox.
 *
 * Deliberately does NOT clear on mouseleave: opening the lightbox covers the hovered
 * element with a fixed overlay at the same screen position, which makes the browser
 * re-run hit-testing and fire a genuine mouseleave on it even though the cursor never
 * moved — clearing there would wipe the very media the lightbox is about to show.
 */
export function hoverableMedia(media: HoveredMedia) {
  return {
    onMouseEnter: () => setHoveredMedia(media),
  };
}
