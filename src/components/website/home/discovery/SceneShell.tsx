import type { ReactNode } from "react";
import { useInViewport } from "@/lib/website/use-in-viewport";

/**
 * Shared frame for the TAKATAK discovery service scenes.
 *
 * Every scene is decorative: it illustrates a service story with interface
 * geometry only (no stock photography, no fabricated metrics). The card copy
 * next to it carries all meaning, so the scene is hidden from assistive tech.
 *
 * Choreography runs once, only when the scene enters the viewport, using the
 * shared observer hook and the `.tk-play`/`.tk-step` CSS utilities.
 */
export function SceneShell({
  children,
  className = "",
  ratio = "aspect-[16/9]",
}: {
  children: ReactNode;
  className?: string;
  ratio?: string;
}) {
  const [ref, inView] = useInViewport<HTMLDivElement>({ once: true });
  return (
    <div
      ref={ref}
      aria-hidden
      data-play={inView ? "true" : "false"}
      className={`${inView ? "tk-play" : ""} relative w-full overflow-hidden rounded-xl border border-border bg-[color-mix(in_oklab,var(--foreground)_3%,var(--background))] ${ratio} ${className}`}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in oklab, var(--foreground) 6%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--foreground) 6%, transparent) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(ellipse at 30% 20%, black 10%, transparent 80%)",
        }}
      />
      {children}
    </div>
  );
}

/** Small labelled interface chip used inside the scenes. */
export function SceneChip({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <span
      style={{ animationDelay: `${delay}ms` }}
      className={`tk-step inline-flex items-center gap-1 rounded-full border border-primary/35 bg-background/85 px-2 py-0.5 text-[9px] font-semibold tracking-wide text-foreground backdrop-blur ${className}`}
    >
      {children}
    </span>
  );
}

/** A neutral surface block (wireframe bar, panel row, etc.). */
export function SceneBar({
  delay = 0,
  className = "",
  tone = "muted",
}: {
  delay?: number;
  className?: string;
  tone?: "muted" | "primary" | "strong";
}) {
  const bg =
    tone === "primary" ? "bg-primary/70" : tone === "strong" ? "bg-foreground/25" : "bg-foreground/10";
  return (
    <span
      style={{ animationDelay: `${delay}ms` }}
      className={`tk-step block rounded-full ${bg} ${className}`}
    />
  );
}

/** Browser chrome wrapper used by website/marketing scenes. */
export function SceneBrowser({
  children,
  label,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  label: string;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className={`tk-step overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)] ${className}`}
    >
      <div className="flex items-center gap-1 border-b border-border bg-secondary/70 px-2 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
        <span className="ml-1.5 truncate rounded bg-background px-1.5 py-0.5 text-[8px] text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}