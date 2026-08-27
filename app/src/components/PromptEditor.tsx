import { useState } from "react";
import type { PromptDef } from "@server/types";

function enabledStyle(enabled: boolean) {
  return {
    borderColor: enabled ? "#0a0" : undefined,
    background: enabled ? "#e6ffe6" : undefined,
    color: enabled ? "#070" : undefined,
  };
}

export function PromptEditor({
  prompts,
  onAdd,
  onUpdate,
  onDelete,
}: {
  prompts: PromptDef[];
  onAdd: (text: string, enabled: boolean) => void;
  onUpdate: (id: string, patch: { text?: string; enabled?: boolean }) => void;
  onDelete: (id: string) => void;
}) {
  const [newText, setNewText] = useState("");
  const [newEnabled, setNewEnabled] = useState(false);

  function submitNew() {
    if (!newText.trim()) return;
    onAdd(newText.trim(), newEnabled);
    setNewText("");
    setNewEnabled(false);
  }

  return (
    <div>
      <h2>Actions</h2>
      <ul style={{ listStyle: "none", padding: 0, maxHeight: 320, overflowY: "auto" }}>
        {prompts.map((p) => (
          <li key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.3rem", borderBottom: "1px solid #ddd", padding: "0.3rem 0" }}>
            <input
              type="text"
              defaultValue={p.text}
              style={{ flex: 1, minWidth: 0 }}
              onBlur={(e) => {
                if (e.target.value !== p.text) onUpdate(p.id, { text: e.target.value });
              }}
            />
            <button
              onClick={() => onUpdate(p.id, { enabled: !p.enabled })}
              title={p.enabled ? "disable" : "enable"}
              style={enabledStyle(p.enabled)}
            >
              +
            </button>
            <button onClick={() => onDelete(p.id)} title="delete">
              x
            </button>
          </li>
        ))}
      </ul>

      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.5rem", borderTop: "1px solid #ddd", paddingTop: "0.5rem" }}>
        <input
          type="text"
          placeholder="new prompt"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button onClick={() => setNewEnabled((v) => !v)} title={newEnabled ? "will start enabled" : "will start disabled"} style={enabledStyle(newEnabled)}>
          +
        </button>
        <button onClick={submitNew} title="add">
          add
        </button>
      </div>
    </div>
  );
}
