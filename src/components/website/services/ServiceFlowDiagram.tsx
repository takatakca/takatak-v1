import type { FlowKind } from "@/lib/website/service-pages";

const ICONS: Record<FlowKind, readonly string[]> = {
  domain: ["search", "shield", "network", "globe"],
  hosting: ["server", "shield", "wordpress", "globe"],
  website: ["brief", "design", "build", "launch"],
  design: ["brief", "design", "revise", "launch"],
  marketing: ["target", "megaphone", "users", "chart"],
  local: ["search", "pin", "network", "chart"],
  leads: ["form", "filter", "users", "bell"],
  voip: ["phone", "menu", "voicemail", "chart"],
  automation: ["task", "gear", "bell", "chart"],
  marketplace: ["form", "users", "workspace", "check"],
};

/** Lightweight animated SVG flow. Pure CSS animation, respects reduced motion. */
export function ServiceFlowDiagram({
  flow,
  steps,
}: {
  flow: FlowKind;
  steps: readonly string[];
}) {
  const nodes = steps.slice(0, 4);
  const glyphs = ICONS[flow];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-7">
      <svg
        viewBox="0 0 760 120"
        role="img"
        aria-label={nodes.join(" → ")}
        className="hidden h-[120px] w-full md:block"
      >
        <defs>
          <linearGradient id="tk-flow-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.15" />
            <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.75" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        <line x1="60" y1="46" x2="700" y2="46" stroke="url(#tk-flow-line)" strokeWidth="2" />
        <circle r="4" fill="var(--primary)" className="tk-flow-dot">
          <animateMotion dur="4.5s" repeatCount="indefinite" path="M60,46 L700,46" />
        </circle>

        {nodes.map((label, i) => {
          const x = 60 + i * (640 / Math.max(nodes.length - 1, 1));
          return (
            <g key={label}>
              <circle
                cx={x}
                cy={46}
                r={16}
                fill="var(--card)"
                stroke="var(--primary)"
                strokeWidth="1.5"
                opacity="0.95"
              />
              <text
                x={x}
                y={51}
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill="var(--primary)"
              >
                {i + 1}
              </text>
              <text
                x={x}
                y={86}
                textAnchor="middle"
                fontSize="12"
                fill="var(--muted-foreground)"
              >
                {label.length > 26 ? `${label.slice(0, 25)}…` : label}
              </text>
            </g>
          );
        })}
      </svg>

      <ol className="grid gap-3 md:hidden">
        {nodes.map((label, i) => (
          <li key={label} className="flex items-center gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-xs font-bold text-primary">
              {i + 1}
            </span>
            <span className="text-sm text-foreground">{label}</span>
          </li>
        ))}
      </ol>
      <span className="sr-only">{glyphs.join(" ")}</span>
    </div>
  );
}