import type { FilmState, Generation, GenerationParams } from "@server/types";

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

  getState: (film: string) => req<FilmState>(`/api/films/${film}/state`),

  addPrompt: (film: string, text: string, isGlobal: boolean) =>
    req<FilmState>(`/api/films/${film}/prompts`, {
      method: "POST",
      body: JSON.stringify({ text, isGlobal }),
    }),

  updatePrompt: (
    film: string,
    id: string,
    patch: { text?: string; isGlobal?: boolean; globalEnabled?: boolean },
  ) =>
    req<FilmState>(`/api/films/${film}/prompts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  deletePrompt: (film: string, id: string) =>
    req<FilmState>(`/api/films/${film}/prompts/${id}`, { method: "DELETE" }),

  updateShot: (film: string, filename: string, patch: { selectedPromptIds?: string[]; customText?: string }) =>
    req<FilmState>(`/api/films/${film}/shots/${encodeURIComponent(filename)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  generate: (film: string, filename: string, params: GenerationParams) =>
    req<Generation>(`/api/films/${film}/shots/${encodeURIComponent(filename)}/generate`, {
      method: "POST",
      body: JSON.stringify(params),
    }),
};
