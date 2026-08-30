export interface PromptDef {
  id: string;
  text: string;
  /** Every prompt is global; enabled ones are stitched into every shot's generation. */
  enabled: boolean;
  createdAt: string;
}

export type GenerationStatus = "queued" | "in_progress" | "completed" | "error";

export interface GenerationParams {
  duration: number;
  resolution: "480P" | "768P";
  seed?: number;
}

export interface Generation {
  id: string;
  status: GenerationStatus;
  requestId?: string;
  videoFilename?: string;
  error?: string;
  finalPrompt: string;
  params: GenerationParams;
  createdAt: string;
  updatedAt: string;
  /** Trim points in seconds, within [0, params.duration]. Default in=0, out=params.duration. */
  inSec?: number;
  outSec?: number;
}

export interface ShotState {
  filename: string;
  customText: string;
  generations: Generation[];
  /** Set when the source image is no longer found on disk — hides the shot from the film
   * view without losing its generation history. Cleared if the file reappears. */
  deletedAt?: string;
}

export interface TimelineClip {
  id: string;
  shotFilename: string;
  generationId: string;
  /** Clip's own embedded audio is on by default; set true to exclude it from the mix. */
  muted: boolean;
}

export interface Soundtrack {
  filename: string;
  inSec: number;
}

export interface AudioFx {
  /** 0-100, 0 = no reverb */
  reverb: number;
  /** Cutoff frequency in Hz, or null to disable the low-pass filter */
  lowpassHz: number | null;
  /** false (default): applies to the whole mix (clips + soundtrack). true: clip audio only, soundtrack passes through untouched. */
  clipsOnly: boolean;
}

export type AspectRatio = "landscape" | "square" | "portrait";

export interface FilmState {
  prompts: PromptDef[];
  shots: Record<string, ShotState>;
  timeline: TimelineClip[];
  soundtrack: Soundtrack | null;
  audioFx: AudioFx;
  /** landscape = 16:9, square = 1:1, portrait = 9:16. Applies to mux export and preview alike. */
  aspectRatio: AspectRatio;
}

/** What the API actually returns: persisted FilmState plus live-scanned extras. */
export interface FilmStateResponse extends FilmState {
  /** Every audio file currently sitting in the film's folder, for the soundtrack picker. */
  audioFiles: string[];
}

// --- world-builder ---

export type Facing = "N" | "E" | "S" | "W";
export type LevelAction = "walk" | "turnLeft" | "turnRight";

/** Points at an image either in the film's own root folder, or one extracted from a level clip. */
export interface ImageRef {
  source: "film" | "level";
  filename: string;
}

export interface LevelNode {
  id: string;
  x: number;
  y: number;
  facing: Facing;
  image: ImageRef;
}

export interface LevelEdge {
  id: string;
  fromNodeId: string;
  /** null until the generation completes and the destination node is materialized. */
  toNodeId: string | null;
  action: LevelAction;
  status: GenerationStatus;
  requestId?: string;
  videoFilename?: string;
  error?: string;
  finalPrompt: string;
  customText: string;
  params: GenerationParams;
  sourceImage: ImageRef;
  createdAt: string;
  updatedAt: string;
}

export interface LevelState {
  prompts: PromptDef[];
  /** Always-used template for walking forward. */
  walkAheadPrompt: string;
  /** Always-used template for turning, shared by both left and right. */
  turnPrompt: string;
  nodes: LevelNode[];
  edges: LevelEdge[];
  currentNodeId: string | null;
  /** Back-stack of previously-current node ids, for stepping back with S. */
  history: string[];
}

export interface LevelStateResponse extends LevelState {
  /** Source images available in the film's root folder, for the picker grid. */
  images: string[];
}
