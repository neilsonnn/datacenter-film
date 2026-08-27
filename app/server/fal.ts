import { fal } from "@fal-ai/client";
import type { GenerationParams } from "./types";

fal.config({ credentials: process.env.FAL_KEY });

export const MODEL = "minimax/h3-max/image-to-video";

export async function uploadImage(filePath: string): Promise<string> {
  const file = Bun.file(filePath);
  const blob = new Blob([await file.arrayBuffer()], { type: file.type || "image/jpeg" });
  return fal.storage.upload(blob);
}

export async function submitGeneration(
  prompt: string,
  imageUrl: string,
  params: GenerationParams,
): Promise<string> {
  const { request_id } = await fal.queue.submit(MODEL, {
    input: {
      prompt,
      image_url: imageUrl,
      duration: params.duration,
      resolution: params.resolution,
      seed: params.seed,
      prompt_expansion_mode: "balanced",
    },
  });
  return request_id;
}

export type FalQueueStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";

export async function checkStatus(requestId: string): Promise<FalQueueStatus> {
  const status = await fal.queue.status(MODEL, { requestId, logs: false });
  return status.status as FalQueueStatus;
}

export async function fetchResult(requestId: string): Promise<{ videoUrl: string }> {
  const result = await fal.queue.result(MODEL, { requestId });
  const data = result.data as { video: { url: string } };
  return { videoUrl: data.video.url };
}

export async function downloadVideo(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);
  return res.arrayBuffer();
}
