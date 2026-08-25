/**
 * Decorative SVG "infrastructure map" used behind the hero. Connected nodes
 * labelled with the real TAKATAK service surfaces. Motion is disabled under
 * prefers-reduced-motion via the `.tk-pulse` utility in styles.css.
 */
const NODES: readonly { x: number; y: number; label: string }[] = [
  { x: 90, y: 70, label: "Domain" },
  { x: 300, y: 40, label: "Hosting" },
  { x: 520, y: 90, label: "Website" },
  { x: 160, y: 220, label: "Marketing" },
  { x: 390, y: 250, label: "Leads" },
  { x: 600, y: 210, label: "Support" },
];

const LINKS: readonly [number, number][] = [
  [0, 1], [1, 2], [0, 3], [3, 4], [4, 5], [2, 5], [1, 4],
];

export function HeroSystemMap({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 680 300"
      className={`pointer-events-none h-full w-full ${className}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <g stroke="var(--brand-accent-cyan)" strokeOpacity="0.28" strokeWidth="1">
        {LINKS.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={NODES[a]!.x} y1={NODES[a]!.y} x2={NODES[b]!.x} y2={NODES[b]!.y} />
        ))}
      </g>
      {NODES.map((n, i) => (
        <g key={n.label}>
          <circle cx={n.x} cy={n.y} r="14" fill="var(--brand-accent-violet)" fillOpacity="0.12" className="tk-pulse" style={{ animationDelay: `${i * 0.45}s` }} />
          <circle cx={n.x} cy={n.y} r="4" fill="var(--brand-accent-cyan)" />
          <text
            x={n.x + 12}
            y={n.y - 12}
            fill="currentColor"
            fillOpacity="0.4"
            fontSize="9"
            fontWeight="600"
            letterSpacing="0.06em"
          >
            {n.label.toUpperCase()}
          </text>
        </g>
      ))}
    </svg>
  );
}