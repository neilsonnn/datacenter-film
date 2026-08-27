import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { FilmState, ShotState } from "./types";
import { listAudioFiles, listShotImages } from "./scanner";

const FILMS_DIR = path.resolve(import.meta.dir, "..", "..", "films");

function filmDir(film: string): string {
  return path.join(FILMS_DIR, film);
}

function stateFile(film: string): string {
  return path.join(filmDir(film), ".zona", "state.json");
}

function emptyState(): FilmState {
  return {
    prompts: [
      {
        id: "seed-35mm",
        text: "shot on 35mm film, cinematic grain, shallow depth of field",
        isGlobal: true,
        globalEnabled: true,
        createdAt: new Date().toISOString(),
      },
    ],
    shots: {},
    timeline: [],
    soundtrack: null,
    audioFx: { reverb: 0, lowpassHz: null },
  };
}

const cache = new Map<string, FilmState>();
const writeQueues = new Map<string, Promise<unknown>>();

async function readStateFile(film: string): Promise<FilmState> {
  const file = Bun.file(stateFile(film));
  if (!(await file.exists())) return emptyState();
  try {
    const parsed = await file.json();
    return {
      prompts: Array.isArray(parsed.prompts) ? parsed.prompts : [],
      shots: parsed.shots && typeof parsed.shots === "object" ? parsed.shots : {},
      timeline: Array.isArray(parsed.timeline) ? parsed.timeline : [],
      soundtrack: parsed.soundtrack ?? null,
      audioFx: parsed.audioFx ?? { reverb: 0, lowpassHz: null },
    };
  } catch {
    return emptyState();
  }
}

async function persist(film: string, state: FilmState): Promise<void> {
  const prev = writeQueues.get(film) ?? Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(async () => {
      await mkdir(path.join(filmDir(film), ".zona"), { recursive: true });
      await Bun.write(stateFile(film), JSON.stringify(state, null, 2));
    });
  writeQueues.set(film, next);
  await next;
}

async function getState(film: string): Promise<FilmState> {
  let state = cache.get(film);
  if (!state) {
    state = await readStateFile(film);
    cache.set(film, state);
  }
  return state;
}

export function filmsDir(): string {
  return FILMS_DIR;
}

export function repoRoot(): string {
  return path.dirname(FILMS_DIR);
}

export function getFilmDir(film: string): string {
  return filmDir(film);
}

/** Scans disk for shot images and an audio file, merges with persisted state (new files become fresh shots / the soundtrack), persists if changed, and returns the merged state. */
export async function getMergedFilmState(film: string): Promise<FilmState> {
  const state = await getState(film);
  const filenames = await listShotImages(filmDir(film));
  let changed = false;

  for (const filename of filenames) {
    if (!state.shots[filename]) {
      state.shots[filename] = {
        filename,
        selectedPromptIds: [],
        customText: "",
        generations: [],
      };
      changed = true;
    }
  }

  const audioFiles = await listAudioFiles(filmDir(film));
  if (state.soundtrack && !audioFiles.includes(state.soundtrack.filename)) {
    state.soundtrack = null;
    changed = true;
  }
  if (!state.soundtrack && audioFiles.length > 0) {
    state.soundtrack = { filename: audioFiles[0], inSec: 0 };
    changed = true;
  }

  if (changed) await persist(film, state);
  return state;
}

export async function mutateFilmState(
  film: string,
  mutator: (state: FilmState) => void,
): Promise<FilmState> {
  const state = await getState(film);
  mutator(state);
  await persist(film, state);
  return state;
}

export function getShot(state: FilmState, filename: string): ShotState | undefined {
  return state.shots[filename];
}
