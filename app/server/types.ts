export interface PromptDef {
  id: string;
  text: string;
  isGlobal: boolean;
  globalEnabled: boolean;
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
  selectedPromptIds: string[];
  customText: string;
  generations: Generation[];
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

export interface FilmState {
  prompts: PromptDef[];
  shots: Record<string, ShotState>;
  timeline: TimelineClip[];
  soundtrack: Soundtrack | null;
  audioFx: AudioFx;
}

/** What the API actually returns: persisted FilmState plus live-scanned extras. */
export interface FilmStateResponse extends FilmState {
  /** Every audio file currently sitting in the film's folder, for the soundtrack picker. */
  audioFiles: string[];
}
