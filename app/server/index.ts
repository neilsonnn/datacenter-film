import path from "node:path";
import { nanoid } from "nanoid";
import { listFilms } from "./scanner";
import {
  filmsDir,
  getFilmDir,
  getMergedFilmState,
  mutateFilmState,
} from "./state";
import { checkStatus, downloadVideo, fetchResult, submitGeneration, uploadImage } from "./fal";
import type { Generation, GenerationParams, PromptDef, ShotState } from "./types";

const PORT = Number(process.env.PORT) || 8787;

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

function buildFinalPrompt(prompts: PromptDef[], shot: ShotState): string {
  const globals = prompts.filter((p) => p.isGlobal && p.globalEnabled).map((p) => p.text);
  const selected = prompts
    .filter((p) => shot.selectedPromptIds.includes(p.id) && !p.isGlobal)
    .map((p) => p.text);
  const parts = [...globals, ...selected, shot.customText].map((t) => t.trim()).filter(Boolean);
  return parts.join("\n\n");
}

const server = Bun.serve({
  port: PORT,
  idleTimeout: 0,
  routes: {
    "/api/films": {
      GET: async () => json({ films: await listFilms(filmsDir()) }),
    },

    "/api/films/:film/state": {
      GET: async (req) => {
        const state = await getMergedFilmState(req.params.film);
        return json(state);
      },
    },

    "/api/films/:film/prompts": {
      POST: async (req) => {
        const body = (await req.json()) as { text?: string; isGlobal?: boolean };
        if (!body.text?.trim()) return json({ error: "text is required" }, { status: 400 });
        const prompt: PromptDef = {
          id: nanoid(8),
          text: body.text.trim(),
          isGlobal: Boolean(body.isGlobal),
          globalEnabled: true,
          createdAt: new Date().toISOString(),
        };
        const state = await mutateFilmState(req.params.film, (s) => {
          s.prompts.push(prompt);
        });
        return json(state);
      },
    },

    "/api/films/:film/prompts/:id": {
      PATCH: async (req) => {
        const body = (await req.json()) as Partial<Pick<PromptDef, "text" | "isGlobal" | "globalEnabled">>;
        const state = await mutateFilmState(req.params.film, (s) => {
          const prompt = s.prompts.find((p) => p.id === req.params.id);
          if (!prompt) return;
          if (typeof body.text === "string") prompt.text = body.text;
          if (typeof body.isGlobal === "boolean") prompt.isGlobal = body.isGlobal;
          if (typeof body.globalEnabled === "boolean") prompt.globalEnabled = body.globalEnabled;
        });
        return json(state);
      },
      DELETE: async (req) => {
        const state = await mutateFilmState(req.params.film, (s) => {
          s.prompts = s.prompts.filter((p) => p.id !== req.params.id);
          for (const shot of Object.values(s.shots)) {
            shot.selectedPromptIds = shot.selectedPromptIds.filter((id) => id !== req.params.id);
          }
        });
        return json(state);
      },
    },

    "/api/films/:film/shots/:filename": {
      PATCH: async (req) => {
        const body = (await req.json()) as { selectedPromptIds?: string[]; customText?: string };
        const state = await mutateFilmState(req.params.film, (s) => {
          const shot = s.shots[req.params.filename];
          if (!shot) return;
          if (Array.isArray(body.selectedPromptIds)) shot.selectedPromptIds = body.selectedPromptIds;
          if (typeof body.customText === "string") shot.customText = body.customText;
        });
        return json(state);
      },
    },

    "/api/films/:film/shots/:filename/generate": {
      POST: async (req) => {
        const { film, filename } = req.params;
        const body = (await req.json()) as Partial<GenerationParams>;
        const params: GenerationParams = {
          duration: body.duration ?? 6,
          resolution: body.resolution ?? "768P",
          seed: body.seed,
        };

        const state = await getMergedFilmState(film);
        const shot = state.shots[filename];
        if (!shot) return json({ error: "shot not found" }, { status: 404 });

        const finalPrompt = buildFinalPrompt(state.prompts, shot);
        const generation: Generation = {
          id: nanoid(8),
          status: "queued",
          finalPrompt,
          params,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        shot.generations.push(generation);
        await mutateFilmState(film, (s) => {
          s.shots[filename] = shot;
        });

        (async () => {
          try {
            const imageUrl = await uploadImage(path.join(getFilmDir(film), filename));
            const requestId = await submitGeneration(finalPrompt, imageUrl, params);
            await mutateFilmState(film, (s) => {
              const g = s.shots[filename]?.generations.find((gen) => gen.id === generation.id);
              if (g) {
                g.status = "in_progress";
                g.requestId = requestId;
                g.updatedAt = new Date().toISOString();
              }
            });
          } catch (err) {
            await mutateFilmState(film, (s) => {
              const g = s.shots[filename]?.generations.find((gen) => gen.id === generation.id);
              if (g) {
                g.status = "error";
                g.error = err instanceof Error ? err.message : String(err);
                g.updatedAt = new Date().toISOString();
              }
            });
          }
        })();

        return json(generation, { status: 202 });
      },
    },

    "/films/:film/:filename": {
      GET: async (req) => {
        const file = Bun.file(path.join(getFilmDir(req.params.film), req.params.filename));
        if (!(await file.exists())) return new Response("Not found", { status: 404 });
        return new Response(file);
      },
    },
  },

  fetch() {
    return new Response("Not found", { status: 404 });
  },
});

console.log(`datacenter-film server on http://localhost:${server.port}`);

// Background poll loop: advances queued/in_progress generations independent of the browser/Vite.
async function pollGenerations(): Promise<void> {
  const films = await listFilms(filmsDir());
  for (const film of films) {
    const state = await getMergedFilmState(film);
    for (const shot of Object.values(state.shots)) {
      for (const generation of shot.generations) {
        if (generation.status !== "queued" && generation.status !== "in_progress") continue;
        if (!generation.requestId) continue;
        try {
          const falStatus = await checkStatus(generation.requestId);
          if (falStatus === "IN_QUEUE") continue;
          if (falStatus === "IN_PROGRESS") {
            if (generation.status !== "in_progress") {
              await mutateFilmState(film, (s) => {
                const g = s.shots[shot.filename]?.generations.find((gen) => gen.id === generation.id);
                if (g) {
                  g.status = "in_progress";
                  g.updatedAt = new Date().toISOString();
                }
              });
            }
            continue;
          }
          if (falStatus === "COMPLETED") {
            const { videoUrl } = await fetchResult(generation.requestId);
            const bytes = await downloadVideo(videoUrl);
            const stem = path.parse(shot.filename).name;
            const videoFilename = `.${stem}.${generation.id}.mp4`;
            await Bun.write(path.join(getFilmDir(film), videoFilename), bytes);
            await mutateFilmState(film, (s) => {
              const g = s.shots[shot.filename]?.generations.find((gen) => gen.id === generation.id);
              if (g) {
                g.status = "completed";
                g.videoFilename = videoFilename;
                g.updatedAt = new Date().toISOString();
              }
            });
          }
        } catch (err) {
          await mutateFilmState(film, (s) => {
            const g = s.shots[shot.filename]?.generations.find((gen) => gen.id === generation.id);
            if (g) {
              g.status = "error";
              g.error = err instanceof Error ? err.message : String(err);
              g.updatedAt = new Date().toISOString();
            }
          });
        }
      }
    }
  }
}

setInterval(() => {
  pollGenerations().catch((err) => console.error("poll loop error", err));
}, 3000);
