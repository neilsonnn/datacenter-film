import { runFfmpeg } from "./ffmpeg";

/** Grabs the last frame of a video and writes it as a jpeg — used to turn a walk/turn
 * clip's ending view into the next node's source keyframe. */
export async function extractLastFrame(videoPath: string, outputImagePath: string): Promise<void> {
  await runFfmpeg(["-y", "-sseof", "-0.5", "-i", videoPath, "-update", "1", "-q:v", "2", "-frames:v", "1", outputImagePath]);
}
