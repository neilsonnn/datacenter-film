import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppMode = "datacenter-film" | "world-builder";

interface AppModeStore {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

export const useAppModeStore = create<AppModeStore>()(
  persist(
    (set) => ({
      mode: "datacenter-film",
      setMode: (mode) => set({ mode }),
    }),
    { name: "datacenter-film:app-mode" },
  ),
);
