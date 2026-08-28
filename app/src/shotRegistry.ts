import type { Generation } from "@server/types";
import { openLightbox, type LightboxNav } from "./lightbox";

interface ShotEntry {
  film: string;
  filename: string;
  generations: Generation[];
  setIndex: (i: number) => void;
}

const registry = new Map<string, ShotEntry>();
let order: string[] = [];

/** Called by each ShotCard every render so the registry always has fresh generations/setIndex. */
export function registerShot(entry: ShotEntry): void {
  registry.set(entry.filename, entry);
}

/** Called once from the page level whenever the sorted shot list changes. */
export function setShotOrder(filenames: string[]): void {
  order = filenames;
}

function adjacentFilename(filename: string, direction: 1 | -1): string | null {
  const idx = order.indexOf(filename);
  if (idx === -1) return null;
  const next = idx + direction;
  if (next < 0 || next >= order.length) return null;
  return order[next];
}

function selectGeneration(filename: string, index: number): void {
  const entry = registry.get(filename);
  if (!entry) return;
  const clamped = Math.max(0, Math.min(index, entry.generations.length - 1));
  entry.setIndex(clamped);
  const gen = entry.generations[clamped];
  if (gen?.status === "completed" && gen.videoFilename) {
    openLightbox({ kind: "video", src: `/films/${entry.film}/${gen.videoFilename}`, nav: buildShotNav(filename, clamped) });
  } else {
    // no output at this position — fall back to the shot's source image, up/down still work
    openLightbox({
      kind: "image",
      src: `/films/${entry.film}/${filename}`,
      nav: { onUp: () => moveShot(filename, -1), onDown: () => moveShot(filename, 1) },
    });
  }
}

function moveShot(filename: string, direction: 1 | -1): void {
  const adjFilename = adjacentFilename(filename, direction);
  if (!adjFilename) return;
  const adj = registry.get(adjFilename);
  if (!adj) return;
  selectGeneration(adjFilename, adj.generations.length - 1);
}

export function buildShotNav(filename: string, index: number): LightboxNav | undefined {
  const entry = registry.get(filename);
  if (!entry) return undefined;
  const hasGenerations = entry.generations.length > 0;
  const clamped = Math.max(0, Math.min(index, entry.generations.length - 1));
  return {
    counter: hasGenerations ? `${clamped + 1} / ${entry.generations.length}` : undefined,
    onLeft: clamped > 0 ? () => selectGeneration(filename, clamped - 1) : undefined,
    onRight: clamped < entry.generations.length - 1 ? () => selectGeneration(filename, clamped + 1) : undefined,
    onUp: () => moveShot(filename, -1),
    onDown: () => moveShot(filename, 1),
  };
}
