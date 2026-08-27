import * as Switch from "@radix-ui/react-switch";
import type { PromptDef } from "@server/types";

export function GlobalPromptsBar({
  prompts,
  onToggle,
}: {
  prompts: PromptDef[];
  onToggle: (id: string, enabled: boolean) => void;
}) {
  const globals = prompts.filter((p) => p.isGlobal);

  if (globals.length === 0) {
    return <p style={{ color: "#666" }}>No global prompts yet. Mark a prompt as global in the editor below.</p>;
  }

  return (
    <ul style={{ display: "flex", flexDirection: "column", gap: "0.5rem", listStyle: "none", padding: 0 }}>
      {globals.map((p) => (
        <li
          key={p.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            border: "1px solid #ccc",
            padding: "0.3rem 0.6rem",
            maxWidth: 260,
          }}
        >
          <Switch.Root
            checked={p.globalEnabled}
            onCheckedChange={(checked) => onToggle(p.id, checked)}
            style={{ width: 32, height: 18, background: p.globalEnabled ? "#2a7" : "#ccc", borderRadius: 9, position: "relative" }}
          >
            <Switch.Thumb
              style={{
                display: "block",
                width: 14,
                height: 14,
                background: "white",
                borderRadius: "50%",
                transition: "transform 100ms",
                transform: p.globalEnabled ? "translateX(15px)" : "translateX(1px)",
              }}
            />
          </Switch.Root>
          <span
            title={p.text}
            style={{
              opacity: p.globalEnabled ? 1 : 0.5,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {p.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
