import type {
  AspectRatio,
  FilmStateResponse,
  Generation,
  GenerationParams,
  ImageRef,
  LevelAction,
  LevelStateResponse,
} from "@server/types";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${url} failed: ${res.status}`);
  return res.json();
}

export const api = {
  listFilms: () => req<{ films: string[] }>("/api/films"),

  createFilm: (name: string) =>
    req<{ film: string }>("/api/films", { method: "POST", body: JSON.stringify({ name }) }),

  getState: (film: string) => req<FilmStateResponse>(`/api/films/${film}/state`),

  addPrompt: (film: string, text: string, enabled: boolean) =>
    req<FilmStateResponse>(`/api/films/${film}/prompts`, {
      method: "POST",
      body: JSON.stringify({ text, enabled }),
    }),

  updatePrompt: (film: string, id: string, patch: { text?: string; enabled?: boolean }) =>
    req<FilmStateResponse>(`/api/films/${film}/prompts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  deletePrompt: (film: string, id: string) =>
    req<FilmStateResponse>(`/api/films/${film}/prompts/${id}`, { method: "DELETE" }),

  reorderPrompts: (film: string, promptIds: string[]) =>
    req<FilmStateResponse>(`/api/films/${film}/prompts`, {
      method: "PATCH",
      body: JSON.stringify({ promptIds }),
    }),

  importPrompts: (film: string, sourceFilm: string) =>
    req<FilmStateResponse>(`/api/films/${film}/prompts/import`, {
      method: "POST",
      body: JSON.stringify({ sourceFilm }),
    }),

  updateShot: (film: string, filename: string, patch: { customText?: string }) =>
    req<FilmStateResponse>(`/api/films/${film}/shots/${encodeURIComponent(filename)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  revealShot: (film: string, filename: string) =>
    req<{ ok: true }>(`/api/films/${film}/shots/${encodeURIComponent(filename)}/reveal`, { method: "POST" }),

  syncFinderSelection: (film: string, filename: string) =>
    req<{ ok: true }>(`/api/films/${film}/shots/${encodeURIComponent(filename)}/finder-select`, {
      method: "POST",
    }),

  generate: (film: string, filename: string, params: GenerationParams) =>
    req<Generation>(`/api/films/${film}/shots/${encodeURIComponent(filename)}/generate`, {
      method: "POST",
      body: JSON.stringify(params),
    }),

  deleteGeneration: (film: string, filename: string, generationId: string) =>
    req<FilmStateResponse>(
      `/api/films/${film}/shots/${encodeURIComponent(filename)}/generations/${generationId}`,
      { method: "DELETE" },
    ),

  trimGeneration: (film: string, filename: string, generationId: string, patch: { inSec?: number; outSec?: number }) =>
    req<FilmStateResponse>(
      `/api/films/${film}/shots/${encodeURIComponent(filename)}/generations/${generationId}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    ),

  addToTimeline: (film: string, shotFilename: string, generationId: string) =>
    req<FilmStateResponse>(`/api/films/${film}/timeline`, {
      method: "POST",
      body: JSON.stringify({ shotFilename, generationId }),
    }),

  removeFromTimeline: (film: string, clipId: string) =>
    req<FilmStateResponse>(`/api/films/${film}/timeline/${clipId}`, { method: "DELETE" }),

  updateTimelineClip: (film: string, clipId: string, patch: { muted?: boolean }) =>
    req<FilmStateResponse>(`/api/films/${film}/timeline/${clipId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  reorderTimeline: (film: string, clipIds: string[]) =>
    req<FilmStateResponse>(`/api/films/${film}/timeline`, {
      method: "PATCH",
      body: JSON.stringify({ clipIds }),
    }),

  updateSoundtrack: (film: string, patch: { filename?: string | null; inSec?: number }) =>
    req<FilmStateResponse>(`/api/films/${film}/soundtrack`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  updateAudioFx: (film: string, patch: { reverb?: number; lowpassHz?: number | null; clipsOnly?: boolean }) =>
    req<FilmStateResponse>(`/api/films/${film}/audiofx`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  updateAspectRatio: (film: string, aspectRatio: AspectRatio) =>
    req<FilmStateResponse>(`/api/films/${film}/aspect-ratio`, {
      method: "PATCH",
      body: JSON.stringify({ aspectRatio }),
    }),

  exportFilm: (film: string) =>
    req<{ filename: string; outputPath: string }>(`/api/films/${film}/export`, { method: "POST" }),

  revealExport: (film: string, filename: string) =>
    req<{ ok: true }>(`/api/films/${film}/export/reveal`, {
      method: "POST",
      body: JSON.stringify({ filename }),
    }),

  previewFilm: (film: string) =>
    req<{ filename: string; outputPath: string }>(`/api/films/${film}/preview`, { method: "POST" }),

  // --- world-builder ---

  getLevel: (film: string) => req<LevelStateResponse>(`/api/films/${film}/level`),

  addLevelPrompt: (film: string, text: string, enabled: boolean) =>
    req<LevelStateResponse>(`/api/films/${film}/level/prompts`, {
      method: "POST",
      body: JSON.stringify({ text, enabled }),
    }),

  updateLevelPrompt: (film: string, id: string, patch: { text?: string; enabled?: boolean }) =>
    req<LevelStateResponse>(`/api/films/${film}/level/prompts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  deleteLevelPrompt: (film: string, id: string) =>
    req<LevelStateResponse>(`/api/films/${film}/level/prompts/${id}`, { method: "DELETE" }),

  reorderLevelPrompts: (film: string, promptIds: string[]) =>
    req<LevelStateResponse>(`/api/films/${film}/level/prompts`, {
      method: "PATCH",
      body: JSON.stringify({ promptIds }),
    }),

  updateLevelSettings: (film: string, patch: { walkAheadPrompt?: string; turnPrompt?: string }) =>
    req<LevelStateResponse>(`/api/films/${film}/level/settings`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  startLevel: (film: string, imageFilename: string) =>
    req<LevelStateResponse>(`/api/films/${film}/level/start`, {
      method: "POST",
      body: JSON.stringify({ imageFilename }),
    }),

  navigateLevel: (film: string, target: { nodeId: string } | { back: true }) =>
    req<LevelStateResponse>(`/api/films/${film}/level/navigate`, {
      method: "POST",
      body: JSON.stringify(target),
    }),

  generateLevelEdge: (
    film: string,
    body: { action: LevelAction; sourceImage?: ImageRef; customText?: string; duration?: number; seed?: number },
  ) =>
    req<LevelStateResponse>(`/api/films/${film}/level/generate`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteLevelEdge: (film: string, edgeId: string) =>
    req<LevelStateResponse>(`/api/films/${film}/level/edges/${edgeId}`, { method: "DELETE" }),
};
