import { useEffect, useState } from "react";
import type { Generation } from "@server/types";

export function Carousel({ film, generations }: { film: string; generations: Generation[] }) {
  const [index, setIndex] = useState(generations.length - 1);

  useEffect(() => {
    setIndex(generations.length - 1);
  }, [generations.length]);

  if (generations.length === 0) {
    return <p style={{ color: "#666" }}>No generations yet.</p>;
  }

  const gen = generations[Math.max(0, Math.min(index, generations.length - 1))];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <button disabled={index <= 0} onClick={() => setIndex((i) => i - 1)}>
          &larr;
        </button>
        <span>
          {index + 1} / {generations.length}
        </span>
        <button disabled={index >= generations.length - 1} onClick={() => setIndex((i) => i + 1)}>
          &rarr;
        </button>
      </div>

      {gen.status === "completed" && gen.videoFilename && (
        <video
          key={gen.videoFilename}
          controls
          style={{ maxWidth: "100%", maxHeight: 240 }}
          src={`/films/${film}/${gen.videoFilename}`}
        />
      )}
      {(gen.status === "queued" || gen.status === "in_progress") && <p>status: {gen.status}</p>}
      {gen.status === "error" && <p style={{ color: "red" }}>error: {gen.error}</p>}
      <details>
        <summary>prompt sent</summary>
        <pre style={{ whiteSpace: "pre-wrap" }}>{gen.finalPrompt}</pre>
      </details>
    </div>
  );
}
