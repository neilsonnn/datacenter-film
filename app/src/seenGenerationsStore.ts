import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SeenGenerationsStore {
  seen: Record<string, true>;
  markSeen: (generationId: string) => void;
}

export const useSeenGenerationsStore = create<SeenGenerationsStore>()(
  persist(
    (set) => ({
      seen: {},
      markSeen: (generationId) =>
        set((s) => (s.seen[generationId] ? s : { seen: { ...s.seen, [generationId]: true } })),
    }),
    { name: "datacenter-film:seen-generations" },
  ),
);
