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
}

export interface FilmState {
  prompts: PromptDef[];
  shots: Record<string, ShotState>;
  timeline: TimelineClip[];
  soundtrack: Soundtrack | null;
  audioFx: AudioFx;
}
