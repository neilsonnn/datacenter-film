import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import type { AspectRatio } from "./types";
import { getFilmDir, getMergedFilmState, repoRoot } from "./state";
import { runFfmpeg } from "./ffmpeg";

// Target canvas every clip gets cropped-to-fill into, per aspect ratio. fal's "768P"
// setting doesn't produce a perfectly fixed size across every generation (observed both
// 1440x704 and 1440x736 from real clips) — so instead of padding to fit (which bars any
// clip whose exact aspect doesn't match), we scale up to cover this box and crop the
// centered excess, the same object-fit:cover treatment used everywhere else in the app.
const ASPECT_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  landscape: { width: 1440, height: 810 }, // 16:9
  square: { width: 1080, height: 1080 }, // 1:1
  portrait: { width: 810, height: 1440 }, // 9:16
};

function reverbFilter(reverb: number): string {
  // afreeverb isn't available in every ffmpeg build; approximate a simple room reverb
  // with a few short, decaying echo taps instead. factor 0-1 scales how audible they are.
  const factor = reverb / 100;
  const decays = [0.4, 0.3, 0.2].map((d) => (d * factor).toFixed(2)).join("|");
  return `aecho=0.8:0.9:40|60|90:${decays}`;
}

function buildAudioFilterChain(audioFx: { reverb: number; lowpassHz: number | null }): string | null {
  const filters: string[] = [];
  if (audioFx.lowpassHz) filters.push(`lowpass=f=${audioFx.lowpassHz}`);
  if (audioFx.reverb > 0) filters.push(reverbFilter(audioFx.reverb));
  return filters.length > 0 ? filters.join(",") : null;
}

// Always fade the final mix to silence over the last few seconds, regardless of soundtrack/FX settings.
function fadeOutFilter(totalDuration: number): string {
  const fadeDuration = Math.min(3, totalDuration / 2);
  const fadeStart = Math.max(0, totalDuration - fadeDuration);
  return `afade=t=out:st=${fadeStart}:d=${fadeDuration}`;
}

const AMIX = "amix=inputs=2:duration=first:dropout_transition=0";

export async function exportFilm(
  film: string,
  options: { preview?: boolean } = {},
): Promise<{ filename: string; outputPath: string }> {
  const state = await getMergedFilmState(film);
  if (state.timeline.length === 0) throw new Error("timeline is empty");

  const { width: CLIP_WIDTH, height: CLIP_HEIGHT } = ASPECT_DIMENSIONS[state.aspectRatio];
  const filmDir = getFilmDir(film);
  const runId = `export-${Date.now()}`;
  const tmpDir = path.join(filmDir, ".zona", runId);
  await mkdir(tmpDir, { recursive: true });

  try {
    const trimmedPaths: string[] = [];

    for (const clip of state.timeline) {
      const shot = state.shots[clip.shotFilename];
      const gen = shot?.generations.find((g) => g.id === clip.generationId);
      if (!gen || gen.status !== "completed" || !gen.videoFilename) {
        throw new Error(`clip for ${clip.shotFilename} is not a completed generation`);
      }
      const inSec = Math.max(0, gen.inSec ?? 0);
      const outSec = Math.min(gen.params.duration, gen.outSec ?? gen.params.duration);
      if (outSec <= inSec) throw new Error(`invalid trim range for ${clip.shotFilename}`);

      const srcPath = path.join(filmDir, gen.videoFilename);
      const trimmedPath = path.join(tmpDir, `${clip.id}.mp4`);
      await runFfmpeg([
        "-y",
        "-i",
        srcPath,
        "-ss",
        String(inSec),
        "-to",
        String(outSec),
        "-vf",
        `scale=${CLIP_WIDTH}:${CLIP_HEIGHT}:force_original_aspect_ratio=increase,crop=${CLIP_WIDTH}:${CLIP_HEIGHT}:(iw-${CLIP_WIDTH})/2:(ih-${CLIP_HEIGHT})/2,setsar=1`,
        "-r",
        "30",
        // Muted clips still carry a (silent) audio stream, so concat below sees a
        // consistent stream layout across every segment regardless of mute state.
        ...(clip.muted ? ["-af", "volume=0"] : []),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-c:a",
        "aac",
        trimmedPath,
      ]);
      trimmedPaths.push(trimmedPath);
    }

    const totalVideoDuration = state.timeline.reduce((sum, clip) => {
      const shot = state.shots[clip.shotFilename];
      const gen = shot?.generations.find((g) => g.id === clip.generationId)!;
      const inSec = Math.max(0, gen.inSec ?? 0);
      const outSec = Math.min(gen.params.duration, gen.outSec ?? gen.params.duration);
      return sum + (outSec - inSec);
    }, 0);

    const concatListPath = path.join(tmpDir, "concat.txt");
    const concatList = trimmedPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
    await Bun.write(concatListPath, concatList);

    const concatVideoPath = path.join(tmpDir, "concat.mp4");
    // Video is a cheap stream copy, but audio must be decoded and re-encoded here (not
    // copied): each clip above was AAC-encoded independently, and every independent AAC
    // encode carries a few ms of encoder "priming" delay. Splicing those compressed
    // bitstreams together with -c copy leaves that discontinuity baked into the file —
    // inaudible in some players (e.g. Chrome) but an audible click at every cut in others
    // (e.g. QuickTime). Re-encoding here collapses everything into one continuous track.
    await runFfmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatListPath,
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      concatVideoPath,
    ]);

    let outputFilename: string;
    let outputPath: string;
    if (options.preview) {
      outputFilename = ".preview.mp4";
      outputPath = path.join(filmDir, outputFilename);
    } else {
      const exportsDir = path.join(repoRoot(), "exports");
      await mkdir(exportsDir, { recursive: true });
      outputFilename = `${film}-${Date.now()}.mp4`;
      outputPath = path.join(exportsDir, outputFilename);
    }

    const audioFilterChain = buildAudioFilterChain(state.audioFx);
    const fadeFilter = fadeOutFilter(totalVideoDuration);

    if (!state.soundtrack) {
      // Only bus is the clips' own (already muted-where-requested) audio.
      const chain = audioFilterChain ? `${audioFilterChain},${fadeFilter}` : fadeFilter;
      await runFfmpeg([
        "-y",
        "-i",
        concatVideoPath,
        "-af",
        chain,
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-t",
        String(totalVideoDuration),
        outputPath,
      ]);
    } else {
      // Mix clip audio (0:a) with the soundtrack (1:a) — soundtrack no longer replaces
      // clip audio, it plays alongside it. FX either hits the combined mix, or just the
      // clip bus beforehand, depending on audioFx.clipsOnly. The fade-out always applies
      // to the final combined result, regardless of scope.
      const soundtrackPath = path.join(filmDir, state.soundtrack.filename);
      let filterComplex: string;
      if (!audioFilterChain) {
        filterComplex = `[0:a][1:a]${AMIX}[mixed];[mixed]${fadeFilter}[aout]`;
      } else if (state.audioFx.clipsOnly) {
        filterComplex = `[0:a]${audioFilterChain}[a0fx];[a0fx][1:a]${AMIX}[mixed];[mixed]${fadeFilter}[aout]`;
      } else {
        filterComplex = `[0:a][1:a]${AMIX}[mixed];[mixed]${audioFilterChain},${fadeFilter}[aout]`;
      }

      await runFfmpeg([
        "-y",
        "-i",
        concatVideoPath,
        "-ss",
        String(Math.max(0, state.soundtrack.inSec)),
        "-i",
        soundtrackPath,
        "-filter_complex",
        filterComplex,
        "-map",
        "0:v",
        "-map",
        "[aout]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-t",
        String(totalVideoDuration),
        outputPath,
      ]);
    }

    return { filename: outputFilename, outputPath };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
