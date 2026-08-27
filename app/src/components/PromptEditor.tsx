import { useState } from "react";
import type { PromptDef } from "@server/types";

export function PromptEditor({
  prompts,
  onAdd,
  onUpdate,
  onDelete,
}: {
  prompts: PromptDef[];
  onAdd: (text: string, isGlobal: boolean) => void;
  onUpdate: (id: string, patch: { text?: string; isGlobal?: boolean }) => void;
  onDelete: (id: string) => void;
}) {
  const [newText, setNewText] = useState("");
  const [newGlobal, setNewGlobal] = useState(false);

  function submitNew() {
    if (!newText.trim()) return;
    onAdd(newText.trim(), newGlobal);
    setNewText("");
    setNewGlobal(false);
  }

  return (
    <div>
      <h2>Prompt Editor</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {prompts.map((p) => (
          <li key={p.id} style={{ borderBottom: "1px solid #ddd", padding: "0.5rem 0" }}>
            <textarea
              defaultValue={p.text}
              rows={2}
              style={{ width: "100%" }}
              onBlur={(e) => {
                if (e.target.value !== p.text) onUpdate(p.id, { text: e.target.value });
              }}
            />
            <label style={{ marginRight: "1rem" }}>
              <input
                type="checkbox"
                checked={p.isGlobal}
                onChange={(e) => onUpdate(p.id, { isGlobal: e.target.checked })}
              />{" "}
              global
            </label>
            <button onClick={() => onDelete(p.id)}>delete</button>
          </li>
        ))}
      </ul>

      <h3>New prompt</h3>
      <textarea rows={2} style={{ width: "100%" }} value={newText} onChange={(e) => setNewText(e.target.value)} />
      <label style={{ marginRight: "1rem" }}>
        <input type="checkbox" checked={newGlobal} onChange={(e) => setNewGlobal(e.target.checked)} /> global
      </label>
      <button onClick={submitNew}>Add prompt</button>
    </div>
  );
}
