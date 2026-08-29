import { existsSync } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { listFilms } from "./scanner";
import {
  filmsDir,
  getFilmDir,
  getMergedFilmState,
  mutateFilmState,
} from "./state";
import { checkStatus, downloadVideo, fetchResult, MODEL, submitGeneration, uploadImage } from "./fal";
import { exportFilm } from "./export";
import { extractLastFrame } from "./frameExtract";
import { getLevelDir, getMergedLevelState, mutateLevelState } from "./levelState";
import type {
  AspectRatio,
  Facing,
  Generation,
  GenerationParams,
  ImageRef,
  LevelAction,
  LevelEdge,
  LevelNode,
  PromptDef,
  ShotState,
} from "./types";

const PORT = Number(process.env.PORT) || 8787;

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

function buildFinalPrompt(prompts: PromptDef[], shot: ShotState): string {
  const enabled = prompts.filter((p) => p.enabled).map((p) => p.text);
  const parts = [...enabled, shot.customText].map((t) => t.trim()).filter(Boolean);
  return parts.join("\n\n");
}

const WALK_DELTA: Record<Facing, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const LEFT_TURN: Record<Facing, Facing> = { N: "W", W: "S", S: "E", E: "N" };
const RIGHT_TURN: Record<Facing, Facing> = { N: "E", E: "S", S: "W", W: "N" };

function computeTarget(node: LevelNode, action: LevelAction): { x: number; y: number; facing: Facing } {
  if (action === "turnLeft") return { x: node.x, y: node.y, facing: LEFT_TURN[node.facing] };
  if (action === "turnRight") return { x: node.x, y: node.y, facing: RIGHT_TURN[node.facing] };
  const [dx, dy] = WALK_DELTA[node.facing];
  return { x: node.x + dx, y: node.y + dy, facing: node.facing };
}

function buildLevelFinalPrompt(prompts: PromptDef[], actionPrompt: string, customText: string): string {
  const enabled = prompts.filter((p) => p.enabled).map((p) => p.text);
  const parts = [...enabled, actionPrompt, customText].map((t) => t.trim()).filter(Boolean);
  return parts.join("\n\n");
}

function imagePath(film: string, image: ImageRef): string {
  return image.source === "film"
    ? path.join(getFilmDir(film), image.filename)
    : path.join(getLevelDir(film), image.filename);
}

// Starts and ends with an alphanumeric so directory names can't be "." or "..", contain a
// path separator, or trail whitespace/dots (which trips up Windows).
const FILM_NAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9 _-]*[A-Za-z0-9])?$/;

function openInFileManager(absPath: string): void {
  if (process.platform === "darwin") Bun.spawn(["open", absPath]);
  else if (process.platform === "win32") Bun.spawn(["explorer", absPath]);
  else Bun.spawn(["xdg-open", absPath]);
}

const server = Bun.serve({
  port: PORT,
  idleTimeout: 0,
  routes: {
    "/api/films": {
      GET: async () => json({ films: await listFilms(filmsDir()) }),
      POST: async (req) => {
        const body = (await req.json()) as { name?: string };
        const name = body.name?.trim();
        if (!name) return json({ error: "name is required" }, { status: 400 });
        if (!FILM_NAME_RE.test(name)) {
          return json(
            { error: "name may only contain letters, numbers, spaces, - and _" },
            { status: 400 },
          );
        }
        const dir = path.join(filmsDir(), name);
        if (existsSync(dir)) return json({ error: "a film with that name already exists" }, { status: 409 });
        await mkdir(dir, { recursive: true });
        await Bun.write(path.join(dir, "drop-images-in-here.txt"), "");
        openInFileManager(dir);
        return json({ film: name }, { status: 201 });
      },
    },

    "/api/films/:film/state": {
      GET: async (req) => {
        const state = await getMergedFilmState(req.params.film);
        return json(state);
      },
    },

    "/api/films/:film/prompts": {
      POST: async (req) => {
        const body = (await req.json()) as { text?: string; enabled?: boolean };
        if (!body.text?.trim()) return json({ error: "text is required" }, { status: 400 });
        const prompt: PromptDef = {
          id: nanoid(8),
          text: body.text.trim(),
          enabled: Boolean(body.enabled),
          createdAt: new Date().toISOString(),
        };
        const state = await mutateFilmState(req.params.film, (s) => {
          s.prompts.push(prompt);
        });
        return json(state);
      },
      PATCH: async (req) => {
        const body = (await req.json()) as { promptIds?: string[] };
        if (!Array.isArray(body.promptIds)) return json({ error: "promptIds is required" }, { status: 400 });
        const state = await mutateFilmState(req.params.film, (s) => {
          const byId = new Map(s.prompts.map((p) => [p.id, p]));
          const reordered = body.promptIds!.map((id) => byId.get(id)).filter((p) => p != null);
          if (reordered.length === s.prompts.length) s.prompts = reordered;
        });
        return json(state);
      },
    },

    "/api/films/:film/prompts/:id": {
      PATCH: async (req) => {
        const body = (await req.json()) as Partial<Pick<PromptDef, "text" | "enabled">>;
        const state = await mutateFilmState(req.params.film, (s) => {
          const prompt = s.prompts.find((p) => p.id === req.params.id);
          if (!prompt) return;
          if (typeof body.text === "string") prompt.text = body.text;
          if (typeof body.enabled === "boolean") prompt.enabled = body.enabled;
        });
        return json(state);
      },
      DELETE: async (req) => {
        const state = await mutateFilmState(req.params.film, (s) => {
          s.prompts = s.prompts.filter((p) => p.id !== req.params.id);
        });
        return json(state);
      },
    },

    "/api/films/:film/shots/:filename": {
      PATCH: async (req) => {
        const body = (await req.json()) as { customText?: string };
        const state = await mutateFilmState(req.params.film, (s) => {
          const shot = s.shots[req.params.filename];
          if (!shot) return;
          if (typeof body.customText === "string") shot.customText = body.customText;
        });
        return json(state);
      },
    },

    "/api/films/:film/shots/:filename/reveal": {
      POST: async (req) => {
        const absPath = path.join(getFilmDir(req.params.film), req.params.filename);
        try {
          if (process.platform === "darwin") {
            Bun.spawn(["open", "-R", absPath]);
          } else if (process.platform === "win32") {
            Bun.spawn(["explorer", `/select,${absPath}`]);
          } else {
            Bun.spawn(["xdg-open", path.dirname(absPath)]);
          }
          return json({ ok: true });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
        }
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
            console.error(`generate failed for ${film}/${filename}:`, err);
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

    "/api/films/:film/shots/:filename/generations/:generationId": {
      PATCH: async (req) => {
        const { film, filename, generationId } = req.params;
        const body = (await req.json()) as { inSec?: number; outSec?: number };
        const state = await mutateFilmState(film, (s) => {
          const gen = s.shots[filename]?.generations.find((g) => g.id === generationId);
          if (!gen) return;
          if (typeof body.inSec === "number") gen.inSec = Math.max(0, body.inSec);
          if (typeof body.outSec === "number") gen.outSec = Math.min(gen.params.duration, body.outSec);
        });
        return json(state);
      },
      DELETE: async (req) => {
        const { film, filename, generationId } = req.params;
        const state = await getMergedFilmState(film);
        const gen = state.shots[filename]?.generations.find((g) => g.id === generationId);
        if (gen?.videoFilename) {
          await unlink(path.join(getFilmDir(film), gen.videoFilename)).catch(() => {});
        }
        if (gen) {
          const stem = path.parse(filename).name;
          await unlink(path.join(getFilmDir(film), `.${stem}.${gen.id}.json`)).catch(() => {});
        }
        const newState = await mutateFilmState(film, (s) => {
          const shot = s.shots[filename];
          if (shot) shot.generations = shot.generations.filter((g) => g.id !== generationId);
          s.timeline = s.timeline.filter((c) => c.generationId !== generationId);
        });
        return json(newState);
      },
    },

    "/api/films/:film/timeline": {
      POST: async (req) => {
        const body = (await req.json()) as { shotFilename?: string; generationId?: string };
        if (!body.shotFilename || !body.generationId) {
          return json({ error: "shotFilename and generationId are required" }, { status: 400 });
        }
        const state = await mutateFilmState(req.params.film, (s) => {
          s.timeline.push({
            id: nanoid(8),
            shotFilename: body.shotFilename!,
            generationId: body.generationId!,
            muted: false,
          });
        });
        return json(state);
      },
      PATCH: async (req) => {
        const body = (await req.json()) as { clipIds?: string[] };
        if (!Array.isArray(body.clipIds)) return json({ error: "clipIds is required" }, { status: 400 });
        const state = await mutateFilmState(req.params.film, (s) => {
          const byId = new Map(s.timeline.map((c) => [c.id, c]));
          const reordered = body.clipIds!.map((id) => byId.get(id)).filter((c) => c != null);
          if (reordered.length === s.timeline.length) s.timeline = reordered;
        });
        return json(state);
      },
    },

    "/api/films/:film/timeline/:clipId": {
      PATCH: async (req) => {
        const body = (await req.json()) as { muted?: boolean };
        const state = await mutateFilmState(req.params.film, (s) => {
          const clip = s.timeline.find((c) => c.id === req.params.clipId);
          if (clip && typeof body.muted === "boolean") clip.muted = body.muted;
        });
        return json(state);
      },
      DELETE: async (req) => {
        const state = await mutateFilmState(req.params.film, (s) => {
          s.timeline = s.timeline.filter((c) => c.id !== req.params.clipId);
        });
        return json(state);
      },
    },

    "/api/films/:film/soundtrack": {
      PATCH: async (req) => {
        const body = (await req.json()) as { filename?: string | null; inSec?: number };
        const state = await mutateFilmState(req.params.film, (s) => {
          if (body.filename === null) {
            s.soundtrack = null;
          } else if (typeof body.filename === "string") {
            s.soundtrack = {
              filename: body.filename,
              inSec: s.soundtrack?.filename === body.filename ? s.soundtrack.inSec : 0,
            };
          }
          if (s.soundtrack && typeof body.inSec === "number") {
            s.soundtrack.inSec = Math.max(0, body.inSec);
          }
        });
        return json(state);
      },
    },

    "/api/films/:film/audiofx": {
      PATCH: async (req) => {
        const body = (await req.json()) as { reverb?: number; lowpassHz?: number | null; clipsOnly?: boolean };
        const state = await mutateFilmState(req.params.film, (s) => {
          if (typeof body.reverb === "number") s.audioFx.reverb = Math.max(0, Math.min(100, body.reverb));
          if (body.lowpassHz === null || typeof body.lowpassHz === "number") s.audioFx.lowpassHz = body.lowpassHz;
          if (typeof body.clipsOnly === "boolean") s.audioFx.clipsOnly = body.clipsOnly;
        });
        return json(state);
      },
    },

    "/api/films/:film/aspect-ratio": {
      PATCH: async (req) => {
        const body = (await req.json()) as { aspectRatio?: AspectRatio };
        if (!body.aspectRatio || !["landscape", "square", "portrait"].includes(body.aspectRatio)) {
          return json({ error: "aspectRatio must be landscape, square, or portrait" }, { status: 400 });
        }
        const state = await mutateFilmState(req.params.film, (s) => {
          s.aspectRatio = body.aspectRatio!;
        });
        return json(state);
      },
    },

    "/api/films/:film/export": {
      POST: async (req) => {
        try {
          const result = await exportFilm(req.params.film);
          return json(result);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
        }
      },
    },

    "/api/films/:film/preview": {
      POST: async (req) => {
        try {
          const result = await exportFilm(req.params.film, { preview: true });
          return json(result);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
        }
      },
    },

    "/api/films/:film/level": {
      GET: async (req) => json(await getMergedLevelState(req.params.film)),
    },

    "/api/films/:film/level/prompts": {
      POST: async (req) => {
        const body = (await req.json()) as { text?: string; enabled?: boolean };
        if (!body.text?.trim()) return json({ error: "text is required" }, { status: 400 });
        const prompt: PromptDef = {
          id: nanoid(8),
          text: body.text.trim(),
          enabled: Boolean(body.enabled),
          createdAt: new Date().toISOString(),
        };
        const state = await mutateLevelState(req.params.film, (s) => {
          s.prompts.push(prompt);
        });
        return json(state);
      },
      PATCH: async (req) => {
        const body = (await req.json()) as { promptIds?: string[] };
        if (!Array.isArray(body.promptIds)) return json({ error: "promptIds is required" }, { status: 400 });
        const state = await mutateLevelState(req.params.film, (s) => {
          const byId = new Map(s.prompts.map((p) => [p.id, p]));
          const reordered = body.promptIds!.map((id) => byId.get(id)).filter((p) => p != null);
          if (reordered.length === s.prompts.length) s.prompts = reordered;
        });
        return json(state);
      },
    },

    "/api/films/:film/level/prompts/:id": {
      PATCH: async (req) => {
        const body = (await req.json()) as Partial<Pick<PromptDef, "text" | "enabled">>;
        const state = await mutateLevelState(req.params.film, (s) => {
          const prompt = s.prompts.find((p) => p.id === req.params.id);
          if (!prompt) return;
          if (typeof body.text === "string") prompt.text = body.text;
          if (typeof body.enabled === "boolean") prompt.enabled = body.enabled;
        });
        return json(state);
      },
      DELETE: async (req) => {
        const state = await mutateLevelState(req.params.film, (s) => {
          s.prompts = s.prompts.filter((p) => p.id !== req.params.id);
        });
        return json(state);
      },
    },

    "/api/films/:film/level/settings": {
      PATCH: async (req) => {
        const body = (await req.json()) as { walkAheadPrompt?: string; turnPrompt?: string };
        const state = await mutateLevelState(req.params.film, (s) => {
          if (typeof body.walkAheadPrompt === "string") s.walkAheadPrompt = body.walkAheadPrompt;
          if (typeof body.turnPrompt === "string") s.turnPrompt = body.turnPrompt;
        });
        return json(state);
      },
    },

    "/api/films/:film/level/start": {
      POST: async (req) => {
        const body = (await req.json()) as { imageFilename?: string };
        if (!body.imageFilename) return json({ error: "imageFilename is required" }, { status: 400 });
        const state = await mutateLevelState(req.params.film, (s) => {
          if (s.nodes.length > 0) return;
          const node: LevelNode = {
            id: nanoid(8),
            x: 0,
            y: 0,
            facing: "N",
            image: { source: "film", filename: body.imageFilename! },
          };
          s.nodes.push(node);
          s.currentNodeId = node.id;
        });
        return json(state);
      },
    },

    "/api/films/:film/level/edges/:edgeId": {
      DELETE: async (req) => {
        const { film, edgeId } = req.params;
        const state = await getMergedLevelState(film);
        const edge = state.edges.find((e) => e.id === edgeId);
        if (!edge) return json({ error: "edge not found" }, { status: 404 });

        // Only allow deleting a leaf edge — if its destination has further branches, those
        // would be orphaned (pointing at a from-node that no longer exists).
        if (edge.toNodeId && state.edges.some((e) => e.fromNodeId === edge.toNodeId)) {
          return json({ error: "delete the branches beyond this step first" }, { status: 400 });
        }

        if (edge.videoFilename) {
          await unlink(path.join(getLevelDir(film), edge.videoFilename)).catch(() => {});
        }
        const toNode = edge.toNodeId ? state.nodes.find((n) => n.id === edge.toNodeId) : undefined;
        if (toNode?.image.source === "level") {
          await unlink(path.join(getLevelDir(film), toNode.image.filename)).catch(() => {});
        }

        const newState = await mutateLevelState(film, (s) => {
          s.edges = s.edges.filter((e) => e.id !== edgeId);
          if (edge.toNodeId) s.nodes = s.nodes.filter((n) => n.id !== edge.toNodeId);
          if (s.currentNodeId === edge.toNodeId) {
            s.currentNodeId = edge.fromNodeId;
            s.history = s.history.filter((id) => id !== edge.toNodeId);
          }
        });
        return json(newState);
      },
    },

    "/api/films/:film/level/navigate": {
      POST: async (req) => {
        const body = (await req.json()) as { nodeId?: string; back?: boolean };
        const state = await mutateLevelState(req.params.film, (s) => {
          if (body.back) {
            const prev = s.history.pop();
            if (prev) s.currentNodeId = prev;
          } else if (body.nodeId) {
            if (s.currentNodeId && s.currentNodeId !== body.nodeId) s.history.push(s.currentNodeId);
            s.currentNodeId = body.nodeId;
          }
        });
        return json(state);
      },
    },

    "/api/films/:film/level/generate": {
      POST: async (req) => {
        const { film } = req.params;
        const body = (await req.json()) as {
          action?: LevelAction;
          sourceImage?: ImageRef;
          customText?: string;
          duration?: number;
          seed?: number;
        };
        if (!body.action) return json({ error: "action is required" }, { status: 400 });

        const state = await getMergedLevelState(film);
        const currentNode = state.nodes.find((n) => n.id === state.currentNodeId);
        if (!currentNode) return json({ error: "level not started yet" }, { status: 400 });

        const alreadyExists = state.edges.some((e) => e.fromNodeId === currentNode.id && e.action === body.action);
        if (alreadyExists) return json(state);

        const params: GenerationParams = {
          duration: body.duration ?? 6,
          resolution: "768P",
          seed: body.seed,
        };
        const actionPrompt = body.action === "walk" ? state.walkAheadPrompt : state.turnPrompt;
        const customText = body.customText ?? "";
        const finalPrompt = buildLevelFinalPrompt(state.prompts, actionPrompt, customText);
        const sourceImage = body.sourceImage ?? currentNode.image;

        const edge: LevelEdge = {
          id: nanoid(8),
          fromNodeId: currentNode.id,
          toNodeId: null,
          action: body.action,
          status: "queued",
          finalPrompt,
          customText,
          params,
          sourceImage,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const newState = await mutateLevelState(film, (s) => {
          s.edges.push(edge);
        });

        (async () => {
          try {
            const imageUrl = await uploadImage(imagePath(film, sourceImage));
            const requestId = await submitGeneration(finalPrompt, imageUrl, params);
            await mutateLevelState(film, (s) => {
              const e = s.edges.find((x) => x.id === edge.id);
              if (e) {
                e.status = "in_progress";
                e.requestId = requestId;
                e.updatedAt = new Date().toISOString();
              }
            });
          } catch (err) {
            console.error(`level generate failed for ${film} edge ${edge.id}:`, err);
            await mutateLevelState(film, (s) => {
              const e = s.edges.find((x) => x.id === edge.id);
              if (e) {
                e.status = "error";
                e.error = err instanceof Error ? err.message : String(err);
                e.updatedAt = new Date().toISOString();
              }
            });
          }
        })();

        return json(newState);
      },
    },

    "/films/:film/level/:filename": {
      GET: async (req) => {
        const file = Bun.file(path.join(getLevelDir(req.params.film), req.params.filename));
        if (!(await file.exists())) return new Response("Not found", { status: 404 });
        return new Response(file);
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

            const metadata = {
              id: generation.id,
              requestId: generation.requestId,
              model: MODEL,
              sourceImage: shot.filename,
              finalPrompt: generation.finalPrompt,
              params: generation.params,
              createdAt: generation.createdAt,
              completedAt: new Date().toISOString(),
            };
            await Bun.write(
              path.join(getFilmDir(film), `.${stem}.${generation.id}.json`),
              JSON.stringify(metadata, null, 2),
            );

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
          console.error(`poll failed for ${film}/${shot.filename} generation ${generation.id}:`, err);
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

// Background poll loop for world-builder: advances queued/in_progress level edges,
// and on completion downloads the clip, extracts its last frame as the next node's
// keyframe, materializes that node, and auto-advances the walker to it.
async function pollLevelGenerations(): Promise<void> {
  const films = await listFilms(filmsDir());
  for (const film of films) {
    const state = await getMergedLevelState(film);
    for (const edge of state.edges) {
      if (edge.status !== "queued" && edge.status !== "in_progress") continue;
      if (!edge.requestId) continue;
      try {
        const falStatus = await checkStatus(edge.requestId);
        if (falStatus === "IN_QUEUE") continue;
        if (falStatus === "IN_PROGRESS") {
          if (edge.status !== "in_progress") {
            await mutateLevelState(film, (s) => {
              const e = s.edges.find((x) => x.id === edge.id);
              if (e) {
                e.status = "in_progress";
                e.updatedAt = new Date().toISOString();
              }
            });
          }
          continue;
        }
        if (falStatus === "COMPLETED") {
          const { videoUrl } = await fetchResult(edge.requestId);
          const bytes = await downloadVideo(videoUrl);
          const levelDirPath = getLevelDir(film);
          const videoFilename = `.${edge.id}.mp4`;
          await Bun.write(path.join(levelDirPath, videoFilename), bytes);

          const imageFilename = `.${edge.id}.jpg`;
          await extractLastFrame(path.join(levelDirPath, videoFilename), path.join(levelDirPath, imageFilename));

          const fromNode = state.nodes.find((n) => n.id === edge.fromNodeId);
          if (!fromNode) throw new Error(`fromNode ${edge.fromNodeId} not found`);
          const target = computeTarget(fromNode, edge.action);
          const newNode: LevelNode = {
            id: nanoid(8),
            x: target.x,
            y: target.y,
            facing: target.facing,
            image: { source: "level", filename: imageFilename },
          };

          await mutateLevelState(film, (s) => {
            s.nodes.push(newNode);
            const e = s.edges.find((x) => x.id === edge.id);
            if (e) {
              e.status = "completed";
              e.videoFilename = videoFilename;
              e.toNodeId = newNode.id;
              e.updatedAt = new Date().toISOString();
            }
            // Only auto-walk the user forward if they're still standing where this edge
            // started from — if they've since navigated elsewhere, leave them there; the
            // new node is still saved and reachable, it just won't yank focus away.
            if (s.currentNodeId === edge.fromNodeId) {
              s.history.push(s.currentNodeId);
              s.currentNodeId = newNode.id;
            }
          });
        }
      } catch (err) {
        console.error(`level poll failed for ${film} edge ${edge.id}:`, err);
        await mutateLevelState(film, (s) => {
          const e = s.edges.find((x) => x.id === edge.id);
          if (e) {
            e.status = "error";
            e.error = err instanceof Error ? err.message : String(err);
            e.updatedAt = new Date().toISOString();
          }
        });
      }
    }
  }
}

setInterval(() => {
  pollLevelGenerations().catch((err) => console.error("level poll loop error", err));
}, 3000);
