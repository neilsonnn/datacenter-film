import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { LevelState, LevelStateResponse } from "./types";
import { listShotImages } from "./scanner";
import { getFilmDir } from "./state";

function levelDir(film: string): string {
  return path.join(getFilmDir(film), "level");
}

function stateFile(film: string): string {
  return path.join(levelDir(film), ".zona", "state.json");
}

function emptyState(): LevelState {
  return {
    prompts: [],
    walkAheadPrompt: "",
    turnPrompt: "",
    nodes: [],
    edges: [],
    currentNodeId: null,
    history: [],
  };
}

// In-memory only — loaded lazily on first read per film and never invalidated by
// out-of-band filesystem changes (e.g. manually deleting films/{film}/level/ while the
// server is running won't be reflected until the process restarts).
const cache = new Map<string, LevelState>();
const writeQueues = new Map<string, Promise<unknown>>();

async function readStateFile(film: string): Promise<LevelState> {
  const file = Bun.file(stateFile(film));
  if (!(await file.exists())) return emptyState();
  try {
    const parsed = await file.json();
    return {
      prompts: Array.isArray(parsed.prompts) ? parsed.prompts : [],
      walkAheadPrompt: typeof parsed.walkAheadPrompt === "string" ? parsed.walkAheadPrompt : "",
      turnPrompt: typeof parsed.turnPrompt === "string" ? parsed.turnPrompt : "",
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      currentNodeId: parsed.currentNodeId ?? null,
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return emptyState();
  }
}

async function persist(film: string, state: LevelState): Promise<void> {
  const prev = writeQueues.get(film) ?? Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(async () => {
      await mkdir(path.join(levelDir(film), ".zona"), { recursive: true });
      await Bun.write(stateFile(film), JSON.stringify(state, null, 2));
    });
  writeQueues.set(film, next);
  await next;
}

async function getState(film: string): Promise<LevelState> {
  let state = cache.get(film);
  if (!state) {
    state = await readStateFile(film);
    cache.set(film, state);
  }
  return state;
}

export function getLevelDir(film: string): string {
  return levelDir(film);
}

export async function getMergedLevelState(film: string): Promise<LevelStateResponse> {
  const state = await getState(film);
  const images = await listShotImages(getFilmDir(film));
  return { ...state, images };
}

export async function mutateLevelState(
  film: string,
  mutator: (state: LevelState) => void,
): Promise<LevelStateResponse> {
  const state = await getState(film);
  mutator(state);
  await persist(film, state);
  const images = await listShotImages(getFilmDir(film));
  return { ...state, images };
}
