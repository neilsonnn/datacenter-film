import { useEffect, useState } from "react";
import { useAppModeStore, type AppMode } from "../appModeStore";
import { useSelectedFilmStore } from "../selectedFilmStore";
import { api } from "../api";

export const TOP_BAR_HEIGHT = 56;
const POLL_MS = 2000;

export function TopBar() {
  const mode = useAppModeStore((s) => s.mode);
  const setMode = useAppModeStore((s) => s.setMode);
  const selectedFilm = useSelectedFilmStore((s) => s.film);
  const setSelectedFilm = useSelectedFilmStore((s) => s.setFilm);
  const [films, setFilms] = useState<string[]>([]);

  useEffect(() => {
    const tick = () => api.listFilms().then((r) => setFilms(r.films));
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, []);

  async function handleNewFilm() {
    const name = window.prompt("Name for the new film:")?.trim();
    if (!name) return;
    try {
      const { film } = await api.createFilm(name);
      setFilms((await api.listFilms()).films);
      setSelectedFilm(film);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        height: TOP_BAR_HEIGHT,
        boxSizing: "border-box",
        padding: "0 1.5rem",
        borderBottom: "1px solid #000",
        position: "sticky",
        top: 0,
        background: "#fff",
        zIndex: 1000,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as AppMode)}
          style={{ fontWeight: "bold", fontSize: "1rem" }}
        >
          <option value="datacenter-film">datacenter-film</option>
          <option value="world-builder">world-builder</option>
        </select>
        <select value={selectedFilm ?? ""} onChange={(e) => setSelectedFilm(e.target.value)}>
          <option value="" disabled>
            select a film
          </option>
          {films.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <button type="button" onClick={handleNewFilm}>
          + new film
        </button>
      </div>
      <nav style={{ display: "flex", gap: "1rem" }}>
        <a href="https://github.com/neilsonnn/datacenter-film" target="_blank" rel="noopener noreferrer">
          github
        </a>
        <a href="https://x.com/neilsonks" target="_blank" rel="noopener noreferrer">
          x
        </a>
      </nav>
    </header>
  );
}
