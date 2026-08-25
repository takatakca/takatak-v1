import type { ReactNode } from "react";

/** Depth planes: back objects move least, foreground objects move most. */
export function Plane({
  depth = 1,
  shown = true,
  className = "",
  children,
}: {
  depth?: 0 | 1 | 2;
  shown?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const shadow = depth === 2 ? "shadow-[0_38px_80px_-42px_rgba(0,0,0,0.95)]" : depth === 1 ? "shadow-[0_26px_60px_-38px_rgba(0,0,0,0.9)]" : "";
  return (
    <div
      data-depth={depth}
      className={`tk-stage-plane ${shadow} ${className}`}
      data-shown={shown ? "true" : "false"}
    >
      {children}
    </div>
  );
}

/** Frosted interface panel used for every scene object. */
export function Panel({
  title,
  meta,
  className = "",
  active = false,
  children,
}: {
  title?: string;
  meta?: ReactNode;
  className?: string;
  active?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border backdrop-blur-md transition-colors duration-500 ${
        active ? "border-primary/45 bg-primary/[0.07]" : "border-white/12 bg-white/[0.035]"
      } ${className}`}
    >
      {(title || meta) && (
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3.5 py-2">
          {title && <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</span>}
          {meta}
        </div>
      )}
      {children && <div className="p-3.5">{children}</div>}
    </div>
  );
}

/** Small foreground badge — the cinematic accent objects. */
export function StageBadge({
  children,
  tone = "done",
  className = "",
  shown = true,
}: {
  children: ReactNode;
  tone?: "done" | "progress";
  className?: string;
  shown?: boolean;
}) {
  return (
    <span
      data-shown={shown ? "true" : "false"}
      className={`tk-stage-plane inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold shadow-[0_20px_44px_-24px_rgba(0,0,0,0.95)] backdrop-blur-md ${
        tone === "done"
          ? "border-primary/45 bg-primary/15 text-primary"
          : "border-white/18 bg-white/[0.08] text-foreground/85"
      } ${className}`}
    >
      {children}
    </span>
  );
}

/** Browser chrome mockup shell. */
export function BrowserChrome({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/14 bg-[color-mix(in_oklab,var(--brand-dark-2)_92%,transparent)] shadow-[0_38px_80px_-42px_rgba(0,0,0,0.95)]">
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.04] px-3 py-2">
        <span className="flex gap-1.5">
          <i className="h-2 w-2 rounded-full bg-white/25" />
          <i className="h-2 w-2 rounded-full bg-white/20" />
          <i className="h-2 w-2 rounded-full bg-white/15" />
        </span>
        <span className="ml-1 truncate rounded-md border border-white/10 bg-black/25 px-2 py-0.5 text-[10px] text-muted-foreground">{url}</span>
      </div>
      {children}
    </div>
  );
}

/** Simple labelled step row used inside scene panels. */
export function StepRow({
  label,
  reached,
  current,
  right,
}: {
  label: string;
  reached: boolean;
  current?: boolean;
  right?: ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] transition-all duration-500 ${
        reached ? "border-primary/35 bg-primary/[0.08] text-foreground/90" : "border-white/10 bg-white/[0.02] text-muted-foreground opacity-60"
      } ${current ? "translate-x-1" : ""}`}
    >
      <span className="min-w-0 truncate font-medium">{label}</span>
      {reached && right}
    </div>
  );
}