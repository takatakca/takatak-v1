"use client";

import { Link } from "@/lib/website/nav";
import { AnimatedStatus } from "@/components/website/motion/AnimatedStatus";
import { useLanguage } from "@/lib/website/use-language";
import type { EcosystemNodeData } from "./ecosystemNodes";

interface EcosystemNodeProps {
  node: EcosystemNodeData;
  /** The story has reached (or passed) this node. */
  reached: boolean;
  /** This node is the one currently animating. */
  current: boolean;
  /** Hovered, focused or tapped by the visitor. */
  selected: boolean;
  onEnter: () => void;
  onLeave: () => void;
  positioned?: boolean;
}

/**
 * One node of the business ecosystem. It is a real link to the matching
 * service page, so the scene stays crawlable and keyboard-navigable.
 */
export function EcosystemNode({ node, reached, current, selected, onEnter, onLeave, positioned = true }: EcosystemNodeProps) {
  const { tx } = useLanguage();
  const Icon = node.icon;

  return (
    <Link
      to={node.to as never}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      aria-label={`${tx(node.label)} — ${tx(node.explain)}`}
      data-state={selected ? "selected" : reached ? "reached" : "idle"}
      className={`tk-eco-node group block rounded-2xl border p-3 text-left backdrop-blur transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        positioned ? "absolute w-[208px] -translate-x-1/2 -translate-y-1/2" : "w-full"
      } ${
        reached || selected
          ? "border-primary/45 bg-white/[0.14] shadow-[0_24px_60px_-30px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
          : "border-white/12 bg-white/10"
      } ${selected && positioned ? "-translate-y-[calc(50%+6px)]" : ""}`}
    >
      <span className="flex items-center gap-2">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${reached || selected ? "bg-primary/20 text-primary" : "bg-white/10 text-foreground/70"}`}>
          <Icon size={15} aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] leading-tight font-semibold text-foreground">{tx(node.label)}</span>
          <span className="block truncate text-[10.5px] text-muted-foreground">{tx(node.detail)}</span>
        </span>
      </span>
      <span className="mt-2 flex items-center justify-between gap-2">
        <AnimatedStatus status={reached ? node.activeStatus : node.idleStatus} pulse={current} />
      </span>
      {selected && (
        <span className="mt-2 block text-[11px] leading-snug text-foreground/80">{tx(node.explain)}</span>
      )}
    </Link>
  );
}
