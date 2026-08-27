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
}

export interface ShotState {
  filename: string;
  selectedPromptIds: string[];
  customText: string;
  generations: Generation[];
}

export interface FilmState {
  prompts: PromptDef[];
  shots: Record<string, ShotState>;
}
