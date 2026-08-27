import type { FilmStateResponse, Generation, GenerationParams } from "@server/types";

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

  updateShot: (film: string, filename: string, patch: { customText?: string }) =>
    req<FilmStateResponse>(`/api/films/${film}/shots/${encodeURIComponent(filename)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  revealShot: (film: string, filename: string) =>
    req<{ ok: true }>(`/api/films/${film}/shots/${encodeURIComponent(filename)}/reveal`, { method: "POST" }),

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

  exportFilm: (film: string) =>
    req<{ filename: string; outputPath: string }>(`/api/films/${film}/export`, { method: "POST" }),

  previewFilm: (film: string) =>
    req<{ filename: string; outputPath: string }>(`/api/films/${film}/preview`, { method: "POST" }),
};
