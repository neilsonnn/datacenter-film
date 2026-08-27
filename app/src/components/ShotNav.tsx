import type { ShotState } from "@server/types";

export function scrollToShot(shotFilename: string): void {
  document.getElementById(`shot-${encodeURIComponent(shotFilename)}`)?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

const THUMB_WIDTH = 64;
const THUMB_HEIGHT = 36; // 16:9

export function ShotNav({ film, shots }: { film: string; shots: ShotState[] }) {
  return (
    <nav style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {shots.map((shot) => (
        <button
          key={shot.filename}
          onClick={() => scrollToShot(shot.filename)}
          title={shot.filename}
          style={{
            padding: 0,
            border: "1px solid #000",
            borderRadius: 0,
            width: THUMB_WIDTH,
            height: THUMB_HEIGHT,
            background: "none",
          }}
        >
          <img
            src={`/films/${film}/${shot.filename}`}
            alt={shot.filename}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </button>
      ))}
    </nav>
  );
}
