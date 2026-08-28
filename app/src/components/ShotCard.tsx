import { useEffect, useRef, useState } from "react";
import type { GenerationParams, ShotState, TimelineClip } from "@server/types";
import { Carousel } from "./Carousel";
import { hoverableMedia } from "../lightbox";
import { buildShotNav, registerShot } from "../shotRegistry";

const MEDIA_WIDTH = 400;
const MEDIA_HEIGHT = 225; // 16:9
const PROMPT_COL_WIDTH = 260;

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

export function ShotCard({
  film,
  shot,
  genParams,
  timeline,
  onUpdateShot,
  onGenerate,
  onDeleteGeneration,
  onTrimGeneration,
  onAddToTimeline,
  onRemoveFromTimeline,
  onReveal,
}: {
  film: string;
  shot: ShotState;
  genParams: GenerationParams;
  timeline: TimelineClip[];
  onUpdateShot: (filename: string, patch: { customText?: string }) => void;
  onGenerate: (filename: string, params: GenerationParams) => Promise<void>;
  onDeleteGeneration: (filename: string, generationId: string) => void;
  onTrimGeneration: (filename: string, generationId: string, inSec: number, outSec: number) => void;
  onAddToTimeline: (shotFilename: string, generationId: string) => void;
  onRemoveFromTimeline: (clipId: string) => void;
  onReveal: (filename: string) => void;
}) {
  const [customText, setCustomText] = useState(shot.customText);
  const [submitting, setSubmitting] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [index, setIndex] = useState(Math.max(0, shot.generations.length - 1));
  const [showJson, setShowJson] = useState(false);
  const prevStatusesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const prevStatuses = prevStatusesRef.current;
    let justCompletedIndex: number | null = null;
    shot.generations.forEach((g, i) => {
      const prevStatus = prevStatuses.get(g.id);
      if (prevStatus && prevStatus !== "completed" && g.status === "completed") {
        justCompletedIndex = i;
      }
    });
    prevStatusesRef.current = new Map(shot.generations.map((g) => [g.id, g.status]));

    if (justCompletedIndex !== null) {
      // A generation we were watching just finished rendering — jump to it.
      setIndex(justCompletedIndex);
    } else {
      // Otherwise only clamp downward (e.g. after a delete) — never jump forward just
      // because the array grew (a fresh Roll 4/Submit queued item shouldn't yank focus).
      setIndex((i) => Math.min(i, Math.max(0, shot.generations.length - 1)));
    }
  }, [shot.generations]);

  useEffect(() => {
    registerShot({ film, filename: shot.filename, generations: shot.generations, setIndex });
  }, [film, shot.filename, shot.generations]);

  const hasGenerations = shot.generations.length > 0;
  const gen = hasGenerations ? shot.generations[Math.max(0, Math.min(index, shot.generations.length - 1))] : null;
  const timelineClip = gen ? timeline.find((c) => c.shotFilename === shot.filename && c.generationId === gen.id) : undefined;
  const isOnTimeline = timelineClip != null;

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onGenerate(shot.filename, genParams);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoll4() {
    setRolling(true);
    try {
      await Promise.all(
        Array.from({ length: 4 }, () => onGenerate(shot.filename, { ...genParams, seed: randomSeed() })),
      );
    } finally {
      setRolling(false);
    }
  }

  function handleToggleTimeline() {
    if (!gen) return;
    if (timelineClip) onRemoveFromTimeline(timelineClip.id);
    else onAddToTimeline(shot.filename, gen.id);
  }

  return (
    <div
      id={`shot-${encodeURIComponent(shot.filename)}`}
      style={{ border: "1px solid #000", borderRadius: 0, padding: "0.75rem", marginBottom: "1rem" }}
    >
      <div style={{ display: "flex", gap: "1rem", alignItems: "stretch", justifyContent: "space-between" }}>
        <div
          style={{
            width: PROMPT_COL_WIDTH,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem" }}>
              <h3
                style={{
                  margin: 0,
                  minWidth: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {shot.filename}
              </h3>
              <button
                onClick={() => onReveal(shot.filename)}
                title="reveal in file manager"
                style={{ flexShrink: 0, padding: "0 0.3rem" }}
              >
                &#8599;
              </button>
            </div>

            <textarea
              placeholder="custom action for this shot"
              rows={4}
              style={{ width: "100%", boxSizing: "border-box" }}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onBlur={() => onUpdateShot(shot.filename, { customText })}
            />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <button onClick={handleSubmit} disabled={submitting || rolling}>
                {submitting ? "genning..." : "Gen 1"}
              </button>
              <button onClick={handleRoll4} disabled={submitting || rolling}>
                {rolling ? "genning..." : "Gen 4"}
              </button>
              <button disabled={!hasGenerations || index <= 0} onClick={() => setIndex((i) => i - 1)}>
                &larr;
              </button>
              <span>{hasGenerations ? `${index + 1} / ${shot.generations.length}` : "0 / 0"}</span>
              <button
                disabled={!hasGenerations || index >= shot.generations.length - 1}
                onClick={() => setIndex((i) => i + 1)}
              >
                &rarr;
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button
                onClick={handleToggleTimeline}
                disabled={!gen}
                title={isOnTimeline ? "remove from timeline" : "add to timeline"}
                style={{
                  borderColor: isOnTimeline ? "#0a0" : undefined,
                  background: isOnTimeline ? "#e6ffe6" : undefined,
                  color: isOnTimeline ? "#070" : undefined,
                }}
              >
                Add Shot
              </button>
              <button disabled={!gen} onClick={() => setShowJson((v) => !v)} title="view output JSON">
                {"{}"}
              </button>
              <button
                disabled={!gen}
                onClick={() => gen && onDeleteGeneration(shot.filename, gen.id)}
                title="delete this generation"
              >
                x
              </button>
            </div>
          </div>
        </div>

        {showJson && gen && (
          <pre
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              zIndex: 1000,
              margin: 0,
              background: "#fff",
              border: "1px solid #000",
              borderRadius: 0,
              padding: "0.75rem",
              maxWidth: "40vw",
              maxHeight: "60vh",
              overflow: "auto",
              fontSize: "0.8rem",
              whiteSpace: "pre-wrap",
            }}
          >
            {JSON.stringify(gen, null, 2)}
          </pre>
        )}

        <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
          <img
            src={`/films/${film}/${shot.filename}`}
            alt={shot.filename}
            {...hoverableMedia({ kind: "image", src: `/films/${film}/${shot.filename}` })}
            style={{
              width: MEDIA_WIDTH,
              height: MEDIA_HEIGHT,
              objectFit: "cover",
              flexShrink: 0,
              border: "1px solid #000",
              boxSizing: "border-box",
            }}
          />

          <Carousel
            film={film}
            generation={gen}
            width={MEDIA_WIDTH}
            height={MEDIA_HEIGHT}
            onTrimChange={(inSec, outSec) => gen && onTrimGeneration(shot.filename, gen.id, inSec, outSec)}
            nav={buildShotNav(shot.filename, index)}
          />
        </div>
      </div>
    </div>
  );
}
