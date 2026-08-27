import { useEffect, useState } from "react";
import type { FilmState, GenerationParams } from "@server/types";
import { api } from "./api";
import { FilmPicker } from "./components/FilmPicker";
import { GlobalPromptsBar } from "./components/GlobalPromptsBar";
import { PromptEditor } from "./components/PromptEditor";
import { ShotCard } from "./components/ShotCard";

const POLL_MS = 2000;

export default function App() {
  const [films, setFilms] = useState<string[]>([]);
  const [selectedFilm, setSelectedFilm] = useState<string | null>(null);
  const [state, setState] = useState<FilmState | null>(null);

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
      <main style={{ padding: "2rem", fontFamily: "system-ui" }}>
        <h1>datacenter-film</h1>
        <p>
          No films yet. Create a folder under <code>films/</code> (e.g. <code>films/my-first-film/</code>) and drag
          some images into it.
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: "1.5rem", fontFamily: "system-ui", maxWidth: 1000, margin: "0 auto" }}>
      <h1>datacenter-film</h1>

      <FilmPicker films={films} selected={selectedFilm} onSelect={setSelectedFilm} />

      {selectedFilm && state && (
        <>
          <section style={{ margin: "1rem 0" }}>
            <h2>Global prompts</h2>
            <GlobalPromptsBar
              prompts={state.prompts}
              onToggle={(id, enabled) => api.updatePrompt(selectedFilm, id, { globalEnabled: enabled }).then(setState)}
            />
          </section>

          <div style={{ display: "flex", gap: "2rem" }}>
            <section style={{ flex: 1, minWidth: 0 }}>
              <PromptEditor
                prompts={state.prompts}
                onAdd={(text, isGlobal) => api.addPrompt(selectedFilm, text, isGlobal).then(setState)}
                onUpdate={(id, patch) => api.updatePrompt(selectedFilm, id, patch).then(setState)}
                onDelete={(id) => api.deletePrompt(selectedFilm, id).then(setState)}
              />
            </section>

            <section style={{ flex: 1, minWidth: 0 }}>
              <h2>Shots</h2>
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
                    onUpdateShot={(filename, patch) => api.updateShot(selectedFilm, filename, patch).then(setState)}
                    onGenerate={async (filename, params: GenerationParams) => {
                      await api.generate(selectedFilm, filename, params);
                      setState(await api.getState(selectedFilm));
                    }}
                  />
                ))}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
