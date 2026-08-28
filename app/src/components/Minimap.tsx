import type { Facing, LevelEdge, LevelNode } from "@server/types";

const CELL = 28;
const PAD = 16;
const FACING_ANGLE: Record<Facing, number> = { N: 0, E: 90, S: 180, W: 270 };

export type TravelState = "at" | "anticipating" | "traveling";

export function Minimap({
  nodes,
  edges,
  currentNodeId,
  onNavigate,
  travelState = "at",
  anticipatedTarget = null,
  travelingEdgeId = null,
}: {
  nodes: LevelNode[];
  edges: LevelEdge[];
  currentNodeId: string | null;
  onNavigate: (nodeId: string) => void;
  travelState?: TravelState;
  anticipatedTarget?: { x: number; y: number; facing: Facing } | null;
  travelingEdgeId?: string | null;
}) {
  if (nodes.length === 0) {
    return (
      <div style={{ border: "1px solid #000", padding: "0.75rem", color: "#666", fontSize: "0.85rem" }}>
        Nothing built yet.
      </div>
    );
  }

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const allXs = anticipatedTarget ? [...xs, anticipatedTarget.x] : xs;
  const allYs = anticipatedTarget ? [...ys, anticipatedTarget.y] : ys;
  const minX = Math.min(...allXs);
  const minY = Math.min(...allYs);
  const width = (Math.max(...allXs) - minX) * CELL + PAD * 2 + 1;
  const height = (Math.max(...allYs) - minY) * CELL + PAD * 2 + 1;

  const px = (x: number) => (x - minX) * CELL + PAD;
  const py = (y: number) => (y - minY) * CELL + PAD;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const current = currentNodeId ? nodeById.get(currentNodeId) : undefined;

  return (
    <svg width={width} height={height} style={{ border: "1px solid #000", background: "#fafafa", display: "block" }}>
      {edges
        .filter((e) => e.toNodeId)
        .map((e) => {
          const from = nodeById.get(e.fromNodeId);
          const to = nodeById.get(e.toNodeId!);
          if (!from || !to) return null;
          const traveling = travelState === "traveling" && e.id === travelingEdgeId;
          return (
            <line
              key={e.id}
              x1={px(from.x)}
              y1={py(from.y)}
              x2={px(to.x)}
              y2={py(to.y)}
              stroke={traveling ? "#f80" : "#999"}
              strokeWidth={traveling ? 4 : 2}
            />
          );
        })}
      {nodes.map((n) => (
        <circle
          key={n.id}
          cx={px(n.x)}
          cy={py(n.y)}
          r={5}
          fill={n.id === currentNodeId ? "#0a0" : "#000"}
          style={{ cursor: "pointer" }}
          onClick={() => onNavigate(n.id)}
        />
      ))}
      {current && (
        <g transform={`translate(${px(current.x)}, ${py(current.y)}) rotate(${FACING_ANGLE[current.facing]})`}>
          <polygon points="0,-13 -5,-5 5,-5" fill="#0a0" />
        </g>
      )}
      {anticipatedTarget && current && (travelState === "anticipating" || travelState === "traveling") && (
        <>
          <line
            x1={px(current.x)}
            y1={py(current.y)}
            x2={px(anticipatedTarget.x)}
            y2={py(anticipatedTarget.y)}
            stroke="#f80"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          <g
            transform={`translate(${px(anticipatedTarget.x)}, ${py(anticipatedTarget.y)}) rotate(${FACING_ANGLE[anticipatedTarget.facing]})`}
          >
            <polygon points="0,-13 -5,-5 5,-5" fill="none" stroke="#f80" strokeWidth={2} />
          </g>
        </>
      )}
    </svg>
  );
}
