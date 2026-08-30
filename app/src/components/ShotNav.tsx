import type { ShotState } from "@server/types";
import { useSeenGenerationsStore } from "../seenGenerationsStore";

const SCROLL_DURATION_MS = 200; // ~2x the felt speed of the native smooth scrollIntoView it replaces

function animateScrollTo(targetY: number, duration: number): void {
  const startY = window.scrollY;
  const delta = targetY - startY;
  if (Math.abs(delta) < 1) return;
  const startTime = performance.now();
  function step(now: number) {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    window.scrollTo(0, startY + delta * eased);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

export function scrollToShot(shotFilename: string): void {
  const el = document.getElementById(`shot-${encodeURIComponent(shotFilename)}`);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const targetY = window.scrollY + rect.top - (window.innerHeight - rect.height) / 2; // center, like block: "center"
  animateScrollTo(targetY, SCROLL_DURATION_MS);
}

const THUMB_WIDTH = 64;
const THUMB_HEIGHT = 36; // 16:9

export function ShotNav({ film, shots }: { film: string; shots: ShotState[] }) {
  const seen = useSeenGenerationsStore((s) => s.seen);
  const markSeen = useSeenGenerationsStore((s) => s.markSeen);
  return (
    <nav style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {shots.map((shot) => {
        const hasUnwatched = shot.generations.some((g) => g.status === "completed" && !seen[g.id]);
        return (
          <button
            key={shot.filename}
            onClick={() => {
              scrollToShot(shot.filename);
              shot.generations.forEach((g) => {
                if (g.status === "completed") markSeen(g.id);
              });
            }}
            title={shot.filename}
            style={{
              position: "relative",
              padding: 0,
              border: "1px solid #000",
              borderRadius: 0,
              width: THUMB_WIDTH,
              height: THUMB_HEIGHT,
              background: "none",
            }}
          >
            {hasUnwatched && (
              <span
                title="finished render — not watched yet"
                style={{
                  position: "absolute",
                  top: 2,
                  left: 2,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#0a0",
                  border: "1px solid #fff",
                  zIndex: 1,
                }}
              />
            )}
            <img
              src={`/films/${film}/${shot.filename}`}
              alt={shot.filename}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </button>
        );
      })}
    </nav>
  );
}
