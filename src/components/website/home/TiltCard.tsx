"use client";

import { useRef, type ReactNode } from "react";

/**
 * Pointer-reactive 3D tilt wrapper. Purely presentational: the transform is
 * driven by CSS custom properties so `prefers-reduced-motion` can disable it.
 */
export function TiltCard({
  children,
  className = "",
  max = 7,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
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
        className={`tk-tilt h-full ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
