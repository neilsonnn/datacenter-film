import { useState } from "react";
import * as Checkbox from "@radix-ui/react-checkbox";
import type { GenerationParams, PromptDef, ShotState } from "@server/types";
import { Carousel } from "./Carousel";

export function ShotCard({
  film,
  shot,
  prompts,
  onUpdateShot,
  onGenerate,
}: {
  film: string;
  shot: ShotState;
  prompts: PromptDef[];
  onUpdateShot: (filename: string, patch: { selectedPromptIds?: string[]; customText?: string }) => void;
  onGenerate: (filename: string, params: GenerationParams) => void;
}) {
  const [customText, setCustomText] = useState(shot.customText);
  const [duration, setDuration] = useState(6);
  const [resolution, setResolution] = useState<"480P" | "768P">("768P");
  const [seed, setSeed] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const nonGlobalPrompts = prompts.filter((p) => !p.isGlobal);

  function toggleSelected(id: string, checked: boolean) {
    const next = checked
      ? [...shot.selectedPromptIds, id]
      : shot.selectedPromptIds.filter((x) => x !== id);
    onUpdateShot(shot.filename, { selectedPromptIds: next });
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onGenerate(shot.filename, {
        duration,
        resolution,
        seed: seed.trim() ? Number(seed) : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ border: "1px solid #ccc", padding: "0.75rem", marginBottom: "1rem" }}>
      <h3>{shot.filename}</h3>
      <img src={`/films/${film}/${shot.filename}`} alt={shot.filename} style={{ maxWidth: "100%", maxHeight: 200 }} />

      {nonGlobalPrompts.length > 0 && (
        <fieldset style={{ margin: "0.5rem 0" }}>
          <legend>prompts</legend>
          {nonGlobalPrompts.map((p) => (
            <label key={p.id} style={{ display: "block" }}>
              <Checkbox.Root
                checked={shot.selectedPromptIds.includes(p.id)}
                onCheckedChange={(checked) => toggleSelected(p.id, checked === true)}
                style={{ marginRight: "0.4rem" }}
              >
                <Checkbox.Indicator>x</Checkbox.Indicator>
              </Checkbox.Root>
              {p.text}
            </label>
          ))}
        </fieldset>
      )}

      <textarea
        placeholder="custom prompt for this shot"
        rows={2}
        style={{ width: "100%" }}
        value={customText}
        onChange={(e) => setCustomText(e.target.value)}
        onBlur={() => onUpdateShot(shot.filename, { customText })}
      />

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", margin: "0.5rem 0" }}>
        <label>
          duration{" "}
          <input
            type="number"
            min={5}
            max={15}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{ width: 50 }}
          />
        </label>
        <label>
          resolution{" "}
          <select value={resolution} onChange={(e) => setResolution(e.target.value as "480P" | "768P")}>
            <option value="480P">480P</option>
            <option value="768P">768P</option>
          </select>
        </label>
        <label>
          seed{" "}
          <input type="number" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ width: 70 }} />
        </label>
        <button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "submitting..." : "Submit"}
        </button>
      </div>

      <Carousel film={film} generations={shot.generations} />
    </div>
  );
}
