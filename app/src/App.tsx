import { useEffect, useState, type CSSProperties } from "react";
import type { FilmStateResponse, GenerationParams } from "@server/types";
import { api } from "./api";
import { FilmPicker } from "./components/FilmPicker";
import { GenerationSettings } from "./components/GenerationSettings";
import { Lightbox } from "./components/Lightbox";
import { PromptEditor } from "./components/PromptEditor";
import { ShotCard } from "./components/ShotCard";
import { ShotNav } from "./components/ShotNav";
import { Timeline, TIMELINE_HEIGHT } from "./components/Timeline";
import { TopBar, TOP_BAR_HEIGHT } from "./components/TopBar";

const POLL_MS = 2000;
const CONTENT_PADDING = 24; // px, matches main's "1.5rem" padding — kept as a shared constant so the
// sticky aside's threshold lines up exactly with where it naturally sits, with zero pre-scroll slack.

const sectionStyle: CSSProperties = {
  border: "1px solid #000",
  borderRadius: 0,
  padding: "1rem",
};

export default function App() {
  const [films, setFilms] = useState<string[]>([]);
  const [selectedFilm, setSelectedFilm] = useState<string | null>(null);
  const [state, setState] = useState<FilmStateResponse | null>(null);
  const [genParams, setGenParams] = useState<GenerationParams>({ duration: 6, resolution: "768P" });
  const sortedShots = state ? Object.values(state.shots).sort((a, b) => a.filename.localeCompare(b.filename)) : [];

  useEffect(() => {
    const tick = () =>
      api.listFilms().then((r) => {
        setFilms(r.films);
        if (r.films.length > 0) setSelectedFilm((prev) => prev ?? r.films[0]);
      });
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selectedFilm) return;
    let cancelled = false;
    const tick = () => api.getState(selectedFilm).then((s) => !cancelled && setState(s));
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selectedFilm]);

  if (films.length === 0) {
    return (
      <>
        <TopBar />
        <main style={{ padding: "2rem", fontFamily: "serif" }}>
          <p>
            No films yet. Create a folder under <code>films/</code> (e.g. <code>films/my-first-film/</code>) and drag
            some images into it.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar />
      <Lightbox />
      <main
        style={{
          padding: CONTENT_PADDING,
          paddingBottom: TIMELINE_HEIGHT + 24,
          fontFamily: "serif",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {selectedFilm && state && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5rem" }}>
          <aside
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
              position: "sticky",
              top: TOP_BAR_HEIGHT + CONTENT_PADDING,
              maxHeight: `calc(100vh - ${TOP_BAR_HEIGHT + CONTENT_PADDING}px - ${TIMELINE_HEIGHT}px)`,
              overflowY: "auto",
            }}
          >
            <section style={sectionStyle}>
              <h2>Film</h2>
              <FilmPicker films={films} selected={selectedFilm} onSelect={setSelectedFilm} />
            </section>

            <section style={sectionStyle}>
              <h2>Video request settings</h2>
              <GenerationSettings params={genParams} onChange={setGenParams} />
            </section>

            <section style={sectionStyle}>
              <PromptEditor
                prompts={state.prompts}
                onAdd={(text, enabled) => api.addPrompt(selectedFilm, text, enabled).then(setState)}
                onUpdate={(id, patch) => api.updatePrompt(selectedFilm, id, patch).then(setState)}
                onDelete={(id) => api.deletePrompt(selectedFilm, id).then(setState)}
              />
            </section>
          </aside>

          <section style={{ flexShrink: 0 }}>
            {sortedShots.length === 0 && (
              <p style={{ color: "#666" }}>
                No shots yet. Drag images into <code>films/{selectedFilm}/</code>.
              </p>
            )}
            {sortedShots.map((shot) => (
              <ShotCard
                key={shot.filename}
                film={selectedFilm}
                shot={shot}
                genParams={genParams}
                timeline={state.timeline}
                onUpdateShot={(filename, patch) => api.updateShot(selectedFilm, filename, patch).then(setState)}
                onGenerate={async (filename, params: GenerationParams) => {
                  await api.generate(selectedFilm, filename, params);
                  setState(await api.getState(selectedFilm));
                }}
                onDeleteGeneration={(filename, generationId) =>
                  api.deleteGeneration(selectedFilm, filename, generationId).then(setState)
                }
                onTrimGeneration={(filename, generationId, inSec, outSec) =>
                  api.trimGeneration(selectedFilm, filename, generationId, { inSec, outSec }).then(setState)
                }
                onAddToTimeline={(shotFilename, generationId) =>
                  api.addToTimeline(selectedFilm, shotFilename, generationId).then(setState)
                }
                onRemoveFromTimeline={(clipId) => api.removeFromTimeline(selectedFilm, clipId).then(setState)}
                onReveal={(filename) => api.revealShot(selectedFilm, filename)}
              />
            ))}
          </section>

          <div
            style={{
              flexShrink: 0,
              marginLeft: "auto",
              position: "sticky",
              top: TOP_BAR_HEIGHT + CONTENT_PADDING,
              maxHeight: `calc(100vh - ${TOP_BAR_HEIGHT + CONTENT_PADDING}px - ${TIMELINE_HEIGHT}px)`,
              overflowY: "auto",
            }}
          >
            <ShotNav film={selectedFilm} shots={sortedShots} />
          </div>
          </div>
        )}

        {selectedFilm && state && (
          <Timeline
            film={selectedFilm}
            state={state}
            onReorder={(clipIds) => api.reorderTimeline(selectedFilm, clipIds).then(setState)}
            onRemoveClip={(clipId) => api.removeFromTimeline(selectedFilm, clipId).then(setState)}
            onToggleClipMute={(clipId, muted) => api.updateTimelineClip(selectedFilm, clipId, { muted }).then(setState)}
            onSelectSoundtrack={(filename) => api.updateSoundtrack(selectedFilm, { filename }).then(setState)}
            onUpdateSoundtrackIn={(inSec) => api.updateSoundtrack(selectedFilm, { inSec }).then(setState)}
            onUpdateAudioFx={(patch) => api.updateAudioFx(selectedFilm, patch).then(setState)}
            onExport={() => api.exportFilm(selectedFilm)}
            onPreview={() => api.previewFilm(selectedFilm)}
          />
        )}
      </main>
    </>
  );
}
