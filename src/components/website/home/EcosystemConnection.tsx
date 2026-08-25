import { FlowLine } from "@/components/website/motion/FlowLine";
import type { EcosystemNodeData } from "./ecosystemNodes";

/**
 * Draws the connection layer between ecosystem nodes. One SVG for the whole
 * scene — no per-line components mounting their own listeners.
 */
export function EcosystemConnection({
  nodes,
  step,
  animated,
}: {
  nodes: readonly EcosystemNodeData[];
  step: number;
  animated: boolean;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 720 520"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full text-foreground"
    >
      {nodes.slice(0, -1).map((n, i) => (
        <FlowLine
          key={`${n.key}-link`}
          from={{ x: n.x, y: n.y }}
          to={{ x: nodes[i + 1]!.x, y: nodes[i + 1]!.y }}
          active={step > i}
          animated={animated && step === i + 1}
        />
      ))}
    </svg>
  );
}
