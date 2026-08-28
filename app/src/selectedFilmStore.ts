import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SelectedFilmStore {
  film: string | null;
  setFilm: (film: string) => void;
}

export const useSelectedFilmStore = create<SelectedFilmStore>()(
  persist(
    (set) => ({
      film: null,
      setFilm: (film) => set({ film }),
    }),
    { name: "datacenter-film:selected-film" },
  ),
);
