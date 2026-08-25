import type { ReactNode } from "react";

/** Slow, restrained float used for depth accents. */
export function FloatingPanel({
  children,
  slow = false,
  className = "",
}: {
  children: ReactNode;
  slow?: boolean;
  className?: string;
}) {
  return <div className={`${slow ? "tk-float-slow" : "tk-float"} ${className}`}>{children}</div>;
}
