import { useEffect, useState, type CSSProperties } from "react";
import type { FilmState, GenerationParams } from "@server/types";
import { api } from "./api";
import { FilmPicker } from "./components/FilmPicker";
import { GenerationSettings } from "./components/GenerationSettings";
import { GlobalPromptsBar } from "./components/GlobalPromptsBar";
import { PromptEditor } from "./components/PromptEditor";
import { ShotCard } from "./components/ShotCard";

const POLL_MS = 2000;

const sectionStyle: CSSProperties = {
  border: "1px solid #000",
  borderRadius: 0,
  padding: "1rem",
};

export default function App() {
  const [films, setFilms] = useState<string[]>([]);
  const [selectedFilm, setSelectedFilm] = useState<string | null>(null);
  const [state, setState] = useState<FilmState | null>(null);
  const [genParams, setGenParams] = useState<GenerationParams>({ duration: 6, resolution: "768P" });

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
      <main style={{ padding: "2rem", fontFamily: "serif" }}>
        <h1>datacenter-film</h1>
        <p>
          No films yet. Create a folder under <code>films/</code> (e.g. <code>films/my-first-film/</code>) and drag
          some images into it.
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: "1.5rem", fontFamily: "serif", width: "100%", boxSizing: "border-box" }}>
      <h1>datacenter-film</h1>

      {selectedFilm && state && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1.5rem" }}>
          <aside style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <section style={sectionStyle}>
              <h2>Film</h2>
              <FilmPicker films={films} selected={selectedFilm} onSelect={setSelectedFilm} />
            </section>

            <section style={sectionStyle}>
              <h2>Video request settings</h2>
              <GenerationSettings params={genParams} onChange={setGenParams} />
            </section>

            <section style={sectionStyle}>
              <h2>Global prompts</h2>
              <GlobalPromptsBar
                prompts={state.prompts}
                onToggle={(id, enabled) =>
                  api.updatePrompt(selectedFilm, id, { globalEnabled: enabled }).then(setState)
                }
              />
            </section>

            <section style={sectionStyle}>
              <PromptEditor
                prompts={state.prompts}
                onAdd={(text, isGlobal) => api.addPrompt(selectedFilm, text, isGlobal).then(setState)}
                onUpdate={(id, patch) => api.updatePrompt(selectedFilm, id, patch).then(setState)}
                onDelete={(id) => api.deletePrompt(selectedFilm, id).then(setState)}
              />
            </section>
          </aside>

          <section>
            {Object.keys(state.shots).length === 0 && (
              <p style={{ color: "#666" }}>
                No shots yet. Drag images into <code>films/{selectedFilm}/</code>.
              </p>
            )}
            {Object.values(state.shots)
              .sort((a, b) => a.filename.localeCompare(b.filename))
              .map((shot) => (
                <ShotCard
                  key={shot.filename}
                  film={selectedFilm}
                  shot={shot}
                  prompts={state.prompts}
                  genParams={genParams}
                  onUpdateShot={(filename, patch) => api.updateShot(selectedFilm, filename, patch).then(setState)}
                  onGenerate={async (filename, params: GenerationParams) => {
                    await api.generate(selectedFilm, filename, params);
                    setState(await api.getState(selectedFilm));
                  }}
                  onDeleteGeneration={(filename, generationId) =>
                    api.deleteGeneration(selectedFilm, filename, generationId).then(setState)
                  }
                />
              ))}
          </section>
        </div>
      )}
    </main>
  );
}
