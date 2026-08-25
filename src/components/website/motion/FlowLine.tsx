interface FlowLineProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** Curved connector instead of a straight segment. */
  curved?: boolean;
  active?: boolean;
  /** Disables the travelling dash when the user prefers reduced motion. */
  animated?: boolean;
  label?: string;
}

/**
 * Meaningful SVG connection between two ecosystem nodes. Coordinates are in
 * the parent SVG's user units. Purely presentational: the accessible copy
 * lives in the node cards themselves.
 */
export function FlowLine({ from, to, curved = true, active = false, animated = true, label }: FlowLineProps) {
  const mx = (from.x + to.x) / 2;
  const d = curved
    ? `M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`
    : `M ${from.x} ${from.y} L ${to.x} ${to.y}`;

  return (
    <g aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
      <path d={d} fill="none" stroke="currentColor" strokeOpacity={active ? 0.55 : 0.18} strokeWidth={1.25} />
      {active && (
        <path
          d={d}
          fill="none"
          stroke="var(--brand-accent-cyan)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="14 220"
          className={animated ? "tk-flow-dash" : undefined}
          opacity={0.95}
        />
      )}
    </g>
  );
}
