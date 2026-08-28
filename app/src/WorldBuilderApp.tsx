import { useEffect, useState, type CSSProperties } from "react";
import type { Facing, LevelAction, LevelEdge, LevelStateResponse } from "@server/types";
import { api } from "./api";
import { ImagePickerGrid } from "./components/ImagePickerGrid";
import { Minimap } from "./components/Minimap";
import { MovementPrompts } from "./components/MovementPrompts";
import { PromptEditor } from "./components/PromptEditor";
import { TOP_BAR_HEIGHT } from "./components/TopBar";
import { hoverableMedia } from "./lightbox";
import { useSelectedFilmStore } from "./selectedFilmStore";

const POLL_MS = 2000;
const CONTENT_PADDING = 24;
const GRID_COL_WIDTH = 260;
const GRID_HEIGHT = 400;
const CUSTOM_TEXT_HEIGHT = 72;
const GRID_COL_GAP = 8; // px, matches the 0.5rem margin between grid and textarea
const BOX_HEIGHT = GRID_HEIGHT + GRID_COL_GAP + CUSTOM_TEXT_HEIGHT;
const BOX_WIDTH = (BOX_HEIGHT * 16) / 9;

const sectionStyle: CSSProperties = {
  border: "1px solid #000",
  borderRadius: 0,
  padding: "1rem",
};

const FACING_WORD: Record<Facing, string> = { N: "north", E: "east", S: "south", W: "west" };
const LEFT_TURN: Record<Facing, Facing> = { N: "W", W: "S", S: "E", E: "N" };
const RIGHT_TURN: Record<Facing, Facing> = { N: "E", E: "S", S: "W", W: "N" };
const WALK_DELTA: Record<Facing, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const ALL_ACTIONS: LevelAction[] = ["walk", "turnLeft", "turnRight"];

function describeAction(action: LevelAction, facing: Facing): string {
  if (action === "walk") return `stepping ${FACING_WORD[facing]}`;
  if (action === "turnLeft") return `turning ${FACING_WORD[LEFT_TURN[facing]]}`;
  return `turning ${FACING_WORD[RIGHT_TURN[facing]]}`;
}

function computeTarget(node: { x: number; y: number; facing: Facing }, action: LevelAction): { x: number; y: number; facing: Facing } {
  if (action === "turnLeft") return { x: node.x, y: node.y, facing: LEFT_TURN[node.facing] };
  if (action === "turnRight") return { x: node.x, y: node.y, facing: RIGHT_TURN[node.facing] };
  const [dx, dy] = WALK_DELTA[node.facing];
  return { x: node.x + dx, y: node.y + dy, facing: node.facing };
}

// WASD are fixed compass directions on the map — W is always north, A always west,
// D always east, S always south — never relative to whichever way we're currently
// facing. What action that resolves to (walk straight ahead vs. turn in place) is
// derived by comparing the pressed direction against the current facing: same
// direction = walk, one 90° turn away = turn that way. The exact opposite direction
// takes two presses (turn, then turn again), since there's no single 180° action.
const KEY_DIRECTION: Record<string, Facing> = { w: "N", a: "W", d: "E", s: "S" };

function resolveAction(facing: Facing, desired: Facing): LevelAction {
  if (facing === desired) return "walk";
  if (RIGHT_TURN[facing] === desired) return "turnRight";
  if (LEFT_TURN[facing] === desired) return "turnLeft";
  return "turnRight"; // opposite direction: turn one way first, the next press finishes the turn
}

const OPPOSITE: Record<Facing, Facing> = { N: "S", S: "N", E: "W", W: "E" };

export function WorldBuilderApp() {
  const [films, setFilms] = useState<string[]>([]);
  const selectedFilm = useSelectedFilmStore((s) => s.film);
  const setSelectedFilm = useSelectedFilmStore((s) => s.setFilm);
  const [level, setLevel] = useState<LevelStateResponse | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [activeEdge, setActiveEdge] = useState<LevelEdge | null>(null);
  const [pendingAction, setPendingAction] = useState<LevelAction | null>(null);
  const [pendingEdgeId, setPendingEdgeId] = useState<string | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      api.listFilms().then((r) => {
        setFilms(r.films);
        const current = useSelectedFilmStore.getState().film;
        if (r.films.length > 0 && (!current || !r.films.includes(current))) setSelectedFilm(r.films[0]);
      });
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selectedFilm) return;
    let cancelled = false;
    const tick = () => api.getLevel(selectedFilm).then((s) => !cancelled && setLevel(s));
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selectedFilm]);

  const currentNode = level?.nodes.find((n) => n.id === level.currentNodeId) ?? null;

  // Explicit walk state: AT a node with nothing armed, ANTICIPATING a pending
  // action that hasn't been confirmed yet, or TRAVELING (generating or playing
  // the transition video) an edge that's already been committed to.
  const travelingEdge = pendingEdgeId ? (level?.edges.find((e) => e.id === pendingEdgeId) ?? null) : activeEdge;
  const walkState: "at" | "anticipating" | "traveling" = travelingEdge ? "traveling" : pendingAction ? "anticipating" : "at";
  const anticipatedTarget =
    walkState === "anticipating" && currentNode && pendingAction
      ? computeTarget(currentNode, pendingAction)
      : walkState === "traveling" && travelingEdge && !travelingEdge.toNodeId
        ? (() => {
            const fromNode = level?.nodes.find((n) => n.id === travelingEdge.fromNodeId);
            return fromNode ? computeTarget(fromNode, travelingEdge.action) : null;
          })()
        : null;

  // Watch for the edge we're waiting on to finish (or fail).
  useEffect(() => {
    if (!pendingEdgeId || !level) return;
    const edge = level.edges.find((e) => e.id === pendingEdgeId);
    if (!edge) return;
    if (edge.status === "completed") {
      setActiveEdge(edge);
      setPendingEdgeId(null);
    } else if (edge.status === "error") {
      setPendingError(edge.error ?? "generation failed");
      setPendingEdgeId(null);
    }
  }, [level, pendingEdgeId]);

  async function handleStart() {
    if (!selectedFilm || !selectedImage) return;
    setLevel(await api.startLevel(selectedFilm, selectedImage));
    setSelectedImage(null);
  }

  async function executeExistingEdge(existing: LevelEdge) {
    if (!selectedFilm || !existing.toNodeId) return;
    setPendingAction(null);
    setPendingError(null);
    setActiveEdge(existing);
    setLevel(await api.navigateLevel(selectedFilm, { nodeId: existing.toNodeId }));
  }

  async function handleConfirm() {
    if (!selectedFilm || !level || !currentNode || pendingEdgeId || !pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);

    const existing = level.edges.find((e) => e.fromNodeId === currentNode.id && e.action === action);
    if (existing?.status === "completed" && existing.toNodeId) {
      await executeExistingEdge(existing);
      return;
    }
    if (existing) return; // already in flight

    setPendingError(null);
    const sourceImage = selectedImage ? ({ source: "film", filename: selectedImage } as const) : undefined;
    const newState = await api.generateLevelEdge(selectedFilm, { action, sourceImage, customText });
    setLevel(newState);
    const created = newState.edges.find((e) => e.fromNodeId === currentNode.id && e.action === action);
    if (created) setPendingEdgeId(created.id);
    setCustomText("");
    setSelectedImage(null);
  }

  async function handleBack() {
    if (!selectedFilm || pendingEdgeId) return;
    setPendingAction(null);
    setActiveEdge(null);
    setPendingError(null);
    setLevel(await api.navigateLevel(selectedFilm, { back: true }));
  }

  async function handleNavigate(nodeId: string) {
    if (!selectedFilm || pendingEdgeId) return;
    setPendingAction(null);
    setActiveEdge(null);
    setPendingError(null);
    setLevel(await api.navigateLevel(selectedFilm, { nodeId }));
  }

  async function handleDeleteCurrentEdge() {
    if (!selectedFilm || !level || pendingEdgeId) return;
    const edge = level.edges.find((e) => e.toNodeId === level.currentNodeId);
    if (!edge) return; // at the root, nothing to undo
    setPendingAction(null);
    setActiveEdge(null);
    setPendingError(null);
    try {
      setLevel(await api.deleteLevelEdge(selectedFilm, edge.id));
    } catch (err) {
      setPendingError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.repeat || !level) return;

      if (level.nodes.length === 0) {
        if (e.key === "Enter") handleStart();
        return;
      }

      // Enter while a transition video is playing = skip straight to the end frame,
      // rather than confirming a pending action.
      if (e.key === "Enter" && activeEdge && !pendingEdgeId) {
        setActiveEdge(null);
        return;
      }
      if (e.key === "Enter") {
        handleConfirm();
        return;
      }

      const key = e.key.toLowerCase();
      const desired = KEY_DIRECTION[key];
      if (desired && currentNode) {
        const dirAction = resolveAction(currentNode.facing, desired);
        // Any direction press interrupts a currently-playing video. If it's the same
        // direction we're already mid-step on, that's "speed travel" — the skip is all
        // this keypress does.
        const skippingSame = activeEdge && !pendingEdgeId && activeEdge.action === dirAction;
        if (activeEdge && !pendingEdgeId) setActiveEdge(null);
        if (skippingSame) return;

        const existing = level.edges.find((edge) => edge.fromNodeId === currentNode.id && edge.action === dirAction);
        // Already generated — walk it instantly, no confirm needed.
        if (existing?.status === "completed" && existing.toNodeId) {
          executeExistingEdge(existing);
          return;
        }
        if (existing) return; // already in flight

        // Walking back the way we came needs no generation — the node (and its
        // image) already exists, we're just reversing the edge that brought us here.
        const reverseWalk = level.edges.find((edge) => {
          if (edge.toNodeId !== currentNode.id || edge.action !== "walk") return false;
          const fromNode = level.nodes.find((n) => n.id === edge.fromNodeId);
          return fromNode ? OPPOSITE[fromNode.facing] === desired : false;
        });
        if (reverseWalk) {
          handleNavigate(reverseWalk.fromNodeId);
          return;
        }

        // Re-orienting to a facing we've already generated at this exact spot —
        // via any edge, not just one leading from here — is also free.
        const reorient = level.nodes.find(
          (n) => n.id !== currentNode.id && n.x === currentNode.x && n.y === currentNode.y && n.facing === desired,
        );
        if (reorient) {
          handleNavigate(reorient.id);
          return;
        }

        setPendingAction(dirAction);
        return;
      }

      if (key === "o") {
        if (level.nodes.length > 0) handleNavigate(level.nodes[0].id);
        return;
      }

      if (e.key === "Escape") setPendingAction(null);
      else if (key === "b") handleBack();
      else if (e.key === "Backspace") handleDeleteCurrentEdge();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, pendingAction, pendingEdgeId, selectedImage, customText, selectedFilm, activeEdge, currentNode]);

  if (films.length === 0) {
    return (
      <main style={{ padding: "2rem", fontFamily: "serif" }}>
        <p>
          No films yet. Create a folder under <code>films/</code> and drag some images into it.
        </p>
      </main>
    );
  }

  // Deliberately no fallback to currentNode.image here — arriving at a node should
  // never eagerly surface the just-extracted last frame as if it were a chosen input.
  // The box stays empty until the player actively picks an override from the grid.
  const inputSrc = selectedImage ? `/films/${selectedFilm}/${selectedImage}` : null;

  return (
    <main style={{ padding: CONTENT_PADDING, fontFamily: "serif", width: "100%", boxSizing: "border-box" }}>
      {selectedFilm && level && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5rem" }}>
          <aside
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
              width: 300,
              flexShrink: 0,
              position: "sticky",
              top: TOP_BAR_HEIGHT + CONTENT_PADDING,
              maxHeight: `calc(100vh - ${TOP_BAR_HEIGHT + CONTENT_PADDING}px)`,
              overflowY: "auto",
            }}
          >
            <section style={sectionStyle}>
              <h2>Movement</h2>
              <MovementPrompts
                walkAheadPrompt={level.walkAheadPrompt}
                turnPrompt={level.turnPrompt}
                onChange={(patch) => api.updateLevelSettings(selectedFilm, patch).then(setLevel)}
              />
            </section>

            <section style={sectionStyle}>
              <PromptEditor
                prompts={level.prompts}
                onAdd={(text, enabled) => api.addLevelPrompt(selectedFilm, text, enabled).then(setLevel)}
                onUpdate={(id, patch) => api.updateLevelPrompt(selectedFilm, id, patch).then(setLevel)}
                onDelete={(id) => api.deleteLevelPrompt(selectedFilm, id).then(setLevel)}
                onReorder={(promptIds) => api.reorderLevelPrompts(selectedFilm, promptIds).then(setLevel)}
              />
            </section>
          </aside>

          <section style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <div style={{ width: GRID_COL_WIDTH, flexShrink: 0 }}>
                <p style={{ fontSize: "0.75rem", color: "#666", marginTop: 0 }}>
                  {level.nodes.length === 0
                    ? "Pick a starting image, then press Enter."
                    : "Pick an image to override the next step's source (otherwise it continues from the current view)."}
                </p>
                <ImagePickerGrid
                  film={selectedFilm}
                  images={level.images}
                  selected={selectedImage}
                  onSelect={setSelectedImage}
                  height={GRID_HEIGHT}
                />
                <textarea
                  placeholder="custom text for the next step"
                  style={{
                    width: "100%",
                    height: CUSTOM_TEXT_HEIGHT,
                    boxSizing: "border-box",
                    marginTop: GRID_COL_GAP,
                    display: "block",
                  }}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                />
              </div>

              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.25rem" }}>input</div>
                <div style={{ width: BOX_WIDTH, height: BOX_HEIGHT, aspectRatio: "16/9", border: "1px solid #000", background: "#fff" }}>
                  {inputSrc ? (
                    <img
                      {...hoverableMedia({ kind: "image", src: inputSrc })}
                      src={inputSrc}
                      alt="input"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: "0.8rem" }}>
                      select an image, then press Enter
                    </div>
                  )}
                </div>
              </div>

              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.25rem" }}>output</div>
                <div style={{ position: "relative", width: BOX_WIDTH, height: BOX_HEIGHT, aspectRatio: "16/9", border: "1px solid #000", background: "#fff" }}>
                  {activeEdge?.videoFilename ? (
                    <video
                      key={activeEdge.id}
                      autoPlay
                      onEnded={() => setActiveEdge(null)}
                      {...hoverableMedia({ kind: "video", src: `/films/${selectedFilm}/level/${activeEdge.videoFilename}` })}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      src={`/films/${selectedFilm}/level/${activeEdge.videoFilename}`}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: "0.8rem" }}>
                      no output yet
                    </div>
                  )}
                  {pendingEdgeId && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(0,0,0,0.5)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      generating...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {currentNode && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>
                    ({currentNode.x}, {currentNode.y}) facing {FACING_WORD[currentNode.facing]}
                  </span>
                  <span style={{ color: "#666" }}>
                    W/A/D/S = N/W/E/S (instant if known) · Enter confirm/skip · Esc cancel · Backspace undo · B back · O origin
                  </span>
                </div>
                {pendingAction && (
                  <div style={{ fontWeight: "bold", marginTop: "0.25rem" }}>
                    {describeAction(pendingAction, currentNode.facing)} — press Enter to confirm
                  </div>
                )}
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.35rem" }}>
                  {ALL_ACTIONS.map((action) => {
                    const existing = level.edges.find((e) => e.fromNodeId === currentNode.id && e.action === action);
                    const ready = existing?.status === "completed" && existing.toNodeId;
                    return (
                      <span key={action} style={{ color: ready ? "#0a0" : "#999" }}>
                        {describeAction(action, currentNode.facing)} · {ready ? "ready" : "new"}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {pendingError && <p style={{ color: "red", fontSize: "0.85rem" }}>{pendingError}</p>}

            <h2 style={{ marginTop: "1rem" }}>Map</h2>
            <Minimap
              nodes={level.nodes}
              edges={level.edges}
              currentNodeId={level.currentNodeId}
              onNavigate={handleNavigate}
              travelState={walkState}
              anticipatedTarget={anticipatedTarget}
              travelingEdgeId={travelingEdge?.toNodeId ? travelingEdge.id : null}
            />
          </section>
        </div>
      )}
    </main>
  );
}
