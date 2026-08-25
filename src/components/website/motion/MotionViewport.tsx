"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useInViewport } from "@/lib/website/use-in-viewport";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";

interface MotionViewportProps {
  /** Receives `active` = visible, motion allowed and tab in foreground. */
  children: (active: boolean) => ReactNode;
  className?: string;
}

/**
 * Gate for looping animations: only runs while the block is on screen, the
 * tab is visible and the user has not asked for reduced motion.
 */
export function MotionViewport({ children, className = "" }: MotionViewportProps) {
  const [ref, inView] = useInViewport<HTMLDivElement>({ once: false, threshold: 0.15 });
  const reduced = useReducedMotion();
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return (
    <div ref={ref} className={className}>
      {children(inView && tabVisible && !reduced)}
    </div>
  );
}
