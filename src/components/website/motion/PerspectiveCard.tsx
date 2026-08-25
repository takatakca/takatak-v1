"use client";

import { useRef, type ReactNode } from "react";
import { motion } from "@/lib/website/motion-config";

interface PerspectiveCardProps {
  children: ReactNode;
  className?: string;
  /** Max tilt in degrees; defaults to the shared, deliberately subtle value. */
  max?: number;
  active?: boolean;
}

/**
 * Pointer-reactive depth card. The tilt is expressed through CSS custom
 * properties so touch devices and reduced-motion users get a flat, readable
 * surface with no JS branching.
 */
export function PerspectiveCard({ children, className = "", max = motion.tilt, active = false }: PerspectiveCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--tk-ry", `${(px * max).toFixed(2)}deg`);
    el.style.setProperty("--tk-rx", `${(-py * max).toFixed(2)}deg`);
  };

  const reset = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tk-ry", "0deg");
    el.style.setProperty("--tk-rx", "0deg");
  };

  return (
    <div className="tk-scene h-full">
      <div
        ref={ref}
        onPointerMove={move}
        onPointerLeave={reset}
        data-active={active ? "true" : "false"}
        className={`tk-tilt h-full ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
