export function MovementPrompts({
  walkAheadPrompt,
  turnPrompt,
  onChange,
}: {
  walkAheadPrompt: string;
  turnPrompt: string;
  onChange: (patch: { walkAheadPrompt?: string; turnPrompt?: string }) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <label style={{ display: "block" }}>
        walk ahead (W)
        <textarea
          key={walkAheadPrompt}
          rows={2}
          defaultValue={walkAheadPrompt}
          style={{ width: "100%", boxSizing: "border-box" }}
          onBlur={(e) => {
            if (e.target.value !== walkAheadPrompt) onChange({ walkAheadPrompt: e.target.value });
          }}
        />
      </label>
      <label style={{ display: "block" }}>
        turn (A/D)
        <textarea
          key={turnPrompt}
          rows={2}
          defaultValue={turnPrompt}
          style={{ width: "100%", boxSizing: "border-box" }}
          onBlur={(e) => {
            if (e.target.value !== turnPrompt) onChange({ turnPrompt: e.target.value });
          }}
        />
      </label>
    </div>
  );
}
