import type { AudioFx } from "@server/types";

export function AudioFxPanel({
  audioFx,
  onChange,
}: {
  audioFx: AudioFx;
  onChange: (patch: { reverb?: number; lowpassHz?: number | null }) => void;
}) {
  return (
    <div>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        reverb ({audioFx.reverb})
        <br />
        <input
          type="range"
          min={0}
          max={100}
          value={audioFx.reverb}
          onChange={(e) => onChange({ reverb: Number(e.target.value) })}
          style={{ width: "100%" }}
        />
      </label>

      <label style={{ display: "block" }}>
        low-pass cutoff, Hz (blank = off)
        <br />
        <input
          type="number"
          min={20}
          placeholder="off"
          value={audioFx.lowpassHz ?? ""}
          onChange={(e) => onChange({ lowpassHz: e.target.value.trim() ? Number(e.target.value) : null })}
          style={{ width: "100%" }}
        />
      </label>
    </div>
  );
}
