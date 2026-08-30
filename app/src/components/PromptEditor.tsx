import { useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { PromptDef } from "@server/types";

function enabledStyle(enabled: boolean) {
  return {
    borderColor: enabled ? "#0a0" : undefined,
    background: enabled ? "#e6ffe6" : undefined,
    color: enabled ? "#070" : undefined,
  };
}

const DRAG_THRESHOLD = 6; // px of pointer movement before a mousedown counts as a drag, not a click into the input

export function PromptEditor({
  prompts,
  otherFilms,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
  onImport,
}: {
  prompts: PromptDef[];
  otherFilms?: string[];
  onAdd: (text: string, enabled: boolean) => void;
  onUpdate: (id: string, patch: { text?: string; enabled?: boolean }) => void;
  onDelete: (id: string) => void;
  onReorder: (promptIds: string[]) => void;
  onImport?: (sourceFilm: string) => void;
}) {
  const [newText, setNewText] = useState("");
  const [newEnabled, setNewEnabled] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  function submitNew() {
    if (!newText.trim()) return;
    onAdd(newText.trim(), newEnabled);
    setNewText("");
    setNewEnabled(false);
  }

  // Rows contain a text input, so we can't use native HTML5 drag-and-drop —
  // starting a drag inside an <input> just selects text instead. Instead we
  // track the raw mouse gesture ourselves and only commit to "dragging the row"
  // once the pointer has actually moved, so a plain click still edits the text.
  function handleRowMouseDown(e: ReactMouseEvent<HTMLLIElement>, index: number) {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let target = index;

    function onMove(ev: globalThis.MouseEvent) {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return;
        dragging = true;
        setDragIndex(index);
      }
      ev.preventDefault(); // stop text selection from growing while we drag
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const row = el?.closest("li[data-prompt-index]");
      const idx = row ? Number(row.getAttribute("data-prompt-index")) : NaN;
      if (!Number.isNaN(idx)) {
        target = idx;
        setOverIndex(idx);
      }
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (dragging && target !== index) {
        const reordered = [...prompts];
        const [moved] = reordered.splice(index, 1);
        reordered.splice(target, 0, moved);
        onReorder(reordered.map((p) => p.id));
      }
      setDragIndex(null);
      setOverIndex(null);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        <h2 style={{ margin: 0 }}>Actions</h2>
        {onImport && (
          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem" }}>
            import
            <select
              value=""
              disabled={!otherFilms || otherFilms.length === 0}
              onChange={(e) => {
                if (e.target.value) onImport(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="" disabled>
                {!otherFilms || otherFilms.length === 0 ? "no other films" : "select a film"}
              </option>
              {otherFilms?.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <ul ref={listRef} style={{ listStyle: "none", padding: 0, maxHeight: 320, overflowY: "auto" }}>
        {prompts.map((p, i) => (
          <li
            key={p.id}
            data-prompt-index={i}
            onMouseDown={(e) => handleRowMouseDown(e, i)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              borderBottom: "1px solid #ddd",
              borderTop: overIndex === i && dragIndex !== null && dragIndex !== i ? "2px solid #0a0" : "2px solid transparent",
              padding: "0.3rem 0",
              opacity: dragIndex === i ? 0.4 : 1,
              cursor: "grab",
            }}
          >
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
