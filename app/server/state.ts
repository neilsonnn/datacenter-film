import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { FilmState, FilmStateResponse, PromptDef, ShotState, TimelineClip } from "./types";
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
        enabled: true,
        createdAt: new Date().toISOString(),
      },
    ],
    shots: {},
    timeline: [],
    soundtrack: null,
    audioFx: { reverb: 0, lowpassHz: null, clipsOnly: false },
  };
}

const cache = new Map<string, FilmState>();
const writeQueues = new Map<string, Promise<unknown>>();

async function readStateFile(film: string): Promise<FilmState> {
  const file = Bun.file(stateFile(film));
  if (!(await file.exists())) return emptyState();
  try {
    const parsed = await file.json();
    const timeline: TimelineClip[] = Array.isArray(parsed.timeline)
      ? parsed.timeline.map((c: TimelineClip) => ({ ...c, muted: c.muted ?? false }))
      : [];
    // Migrate old {isGlobal, globalEnabled} prompts into the single `enabled` flag.
    const prompts: PromptDef[] = Array.isArray(parsed.prompts)
      ? parsed.prompts.map((p: PromptDef & { isGlobal?: boolean; globalEnabled?: boolean }) => ({
          id: p.id,
          text: p.text,
          createdAt: p.createdAt,
          enabled: p.enabled ?? (p.isGlobal ? (p.globalEnabled ?? true) : false),
        }))
      : [];
    return {
      prompts,
      shots: parsed.shots && typeof parsed.shots === "object" ? parsed.shots : {},
      timeline,
      soundtrack: parsed.soundtrack ?? null,
      audioFx: {
        reverb: parsed.audioFx?.reverb ?? 0,
        lowpassHz: parsed.audioFx?.lowpassHz ?? null,
        clipsOnly: parsed.audioFx?.clipsOnly ?? false,
      },
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

/**
 * Syncs a persisted FilmState against what's actually on disk: new images become fresh
 * shots, and a soundtrack whose file vanished gets un-selected. Mutates `state` in place
 * (caller decides whether/when to persist) and returns the live list of audio files.
 */
async function mergeDiskIntoState(film: string, state: FilmState): Promise<{ audioFiles: string[]; changed: boolean }> {
  let changed = false;

  const filenames = await listShotImages(filmDir(film));
  for (const filename of filenames) {
    if (!state.shots[filename]) {
      state.shots[filename] = {
        filename,
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

  return { audioFiles, changed };
}

/** Scans disk, merges into the persisted state, persists if anything changed, and returns the response shape (including live audioFiles). */
export async function getMergedFilmState(film: string): Promise<FilmStateResponse> {
  const state = await getState(film);
  const { audioFiles, changed } = await mergeDiskIntoState(film, state);
  if (changed) await persist(film, state);
  return { ...state, audioFiles };
}

export async function mutateFilmState(
  film: string,
  mutator: (state: FilmState) => void,
): Promise<FilmStateResponse> {
  const state = await getState(film);
  mutator(state);
  const { audioFiles } = await mergeDiskIntoState(film, state);
  await persist(film, state);
  return { ...state, audioFiles };
}

export function getShot(state: FilmState, filename: string): ShotState | undefined {
  return state.shots[filename];
}
