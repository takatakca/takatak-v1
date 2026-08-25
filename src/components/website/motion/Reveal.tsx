import type { CSSProperties, ElementType, ReactNode } from "react";
import { useInViewport } from "@/lib/website/use-in-viewport";
import { motion, type RevealVariant } from "@/lib/website/motion-config";

interface RevealProps {
  children: ReactNode;
  variant?: RevealVariant;
  /** Stagger delay in ms, or index-based via `index`. */
  delay?: number;
  index?: number;
  className?: string;
  as?: ElementType;
}

/**
 * Shared scroll reveal. Renders content immediately (SSR-safe, no layout
 * shift) and only toggles a data attribute; reduced motion is handled in CSS.
 */
export function Reveal({
  children,
  variant = "fade-up",
  delay,
  index,
  className = "",
  as,
}: RevealProps) {
  const [ref, inView] = useInViewport<HTMLDivElement>();
  const Tag = (as ?? "div") as ElementType;
  const ms = delay ?? (index ? index * motion.stagger : 0);
  const style: CSSProperties = ms ? { transitionDelay: `${ms}ms` } : {};

  return (
    <Tag
      ref={ref}
      data-shown={inView ? "true" : "false"}
      data-variant={variant}
      style={style}
      className={`tk-reveal ${className}`}
    >
      {children}
    </Tag>
  );
}
