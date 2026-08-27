export type HoveredMedia = { kind: "image" | "video"; src: string } | null;

let current: HoveredMedia = null;

export function setHoveredMedia(media: HoveredMedia): void {
  current = media;
}

export function getHoveredMedia(): HoveredMedia {
  return current;
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
