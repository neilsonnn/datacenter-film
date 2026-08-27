import type { AudioFx } from "@server/types";

const row = { display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.15rem" } as const;
const label = { flexShrink: 0, width: 48, whiteSpace: "nowrap", overflow: "hidden" } as const;

export function AudioFxPanel({
  audioFx,
  onChange,
}: {
  audioFx: AudioFx;
  onChange: (patch: { reverb?: number; lowpassHz?: number | null; clipsOnly?: boolean }) => void;
}) {
  return (
    <div>
      <div style={row}>
        <span style={label} title="reverb amount">
          reverb
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={audioFx.reverb}
          onChange={(e) => onChange({ reverb: Number(e.target.value) })}
          style={{ flex: 1, minWidth: 0 }}
        />
      </div>

      <div style={row}>
        <span style={label} title="low-pass cutoff in Hz, blank = off">
          lowpass
        </span>
        <input
          type="number"
          min={20}
          placeholder="off"
          value={audioFx.lowpassHz ?? ""}
          onChange={(e) => onChange({ lowpassHz: e.target.value.trim() ? Number(e.target.value) : null })}
          style={{ flex: 1, minWidth: 0 }}
        />
      </div>

      <div style={row}>
        <span style={label} title="apply FX to clip audio only, not the soundtrack">
          clips
        </span>
        <input
          type="checkbox"
          checked={audioFx.clipsOnly}
          onChange={(e) => onChange({ clipsOnly: e.target.checked })}
        />
      </div>
    </div>
  );
}
