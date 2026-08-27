import type { GenerationParams } from "@server/types";

export function GenerationSettings({
  params,
  onChange,
}: {
  params: GenerationParams;
  onChange: (params: GenerationParams) => void;
}) {
  return (
    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
      <label>
        duration{" "}
        <input
          type="number"
          min={5}
          max={15}
          value={params.duration}
          onChange={(e) => onChange({ ...params, duration: Number(e.target.value) })}
          style={{ width: 50 }}
        />
      </label>
      <label>
        resolution{" "}
        <select value={params.resolution} onChange={(e) => onChange({ ...params, resolution: e.target.value as "768P" })}>
          <option value="768P">768P</option>
        </select>
      </label>
      <label>
        seed{" "}
        <input
          type="number"
          value={params.seed ?? ""}
          onChange={(e) => onChange({ ...params, seed: e.target.value.trim() ? Number(e.target.value) : undefined })}
          style={{ width: 70 }}
        />
      </label>
    </div>
  );
}
