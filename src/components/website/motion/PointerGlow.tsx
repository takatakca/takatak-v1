"use client";

import { useRef, type ReactNode } from "react";

/** Soft light that follows the pointer across a dark surface. */
export function PointerGlow({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--tk-gx", `${e.clientX - r.left}px`);
        el.style.setProperty("--tk-gy", `${e.clientY - r.top}px`);
      }}
      className={`tk-pointer-glow ${className}`}
    >
      {children}
    </div>
  );
}
