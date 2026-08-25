import { Check, Calendar, ImageIcon, MapPin, Phone, Zap, Utensils } from "lucide-react";
import { SceneBar, SceneChip, SceneBrowser } from "@/components/website/home/discovery/SceneShell";

/**
 * Product mockups for the trending merchandising rail.
 *
 * Every scene is decorative interface geometry — no stock photography, no
 * fabricated metrics, ratings or order counts. The card copy carries meaning,
 * so scenes are hidden from assistive technology by the shared frame.
 */
function Frame({ children, tint = "" }: { children: React.ReactNode; tint?: string }) {
  return (
    <div
      aria-hidden
      className={`tk-play relative h-full w-full overflow-hidden rounded-xl border border-border bg-[color-mix(in_oklab,var(--foreground)_3%,var(--background))] ${tint}`}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in oklab, var(--foreground) 6%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--foreground) 6%, transparent) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse at 28% 15%, black 8%, transparent 82%)",
        }}
      />
      {children}
    </div>
  );
}

/** Starter website: browser + phone preview. */
export function WebsiteScene() {
  return (
    <Frame>
      <div className="absolute inset-0 p-3 sm:p-4">
        <SceneBrowser label="yourbusiness.ca" className="h-full">
          <div className="p-2.5">
            <div className="flex items-center gap-1.5">
              <SceneBar tone="primary" className="h-1.5 w-7" />
              <SceneBar className="h-1.5 w-5" />
              <SceneBar className="h-1.5 w-5" />
              <SceneBar tone="primary" className="ml-auto h-3 w-9 rounded" />
            </div>
            <div className="mt-2 h-10 rounded-md bg-secondary sm:h-14">
              <span className="tk-sweep block h-full w-1/3 bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--primary)_20%,transparent),transparent)]" />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <SceneBar className="h-5 rounded-md" />
              <SceneBar className="h-5 rounded-md" />
              <SceneBar className="h-5 rounded-md" />
            </div>
          </div>
        </SceneBrowser>
      </div>
      <div className="absolute bottom-3 right-3 w-12 overflow-hidden rounded-md border border-border bg-card shadow-lg">
        <div className="h-1 w-full bg-secondary" />
        <div className="space-y-1 p-1.5">
          <SceneBar tone="primary" className="h-1 w-5" />
          <SceneBar className="h-1 w-full" />
          <SceneBar tone="primary" className="h-2 w-full rounded" />
        </div>
      </div>
      <span className="absolute left-3 top-3 flex gap-1">
        <SceneChip>Responsive</SceneChip>
        <SceneChip className="text-primary">Business-ready</SceneChip>
      </span>
    </Frame>
  );
}

/** Logo design: concept → final mark → swatches → card. */
export function LogoScene() {
  return (
    <Frame>
      <div className="absolute inset-0 grid grid-cols-2 items-center gap-3 p-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-dashed border-foreground/25">
              <span className="h-3.5 w-3.5 rotate-12 rounded-sm border border-foreground/30" />
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-[10px] font-black text-primary-foreground">
              TK
            </span>
          </div>
          <div className="flex gap-1">
            {["bg-primary", "bg-primary/70", "bg-foreground/70", "bg-foreground/25"].map((c) => (
              <span key={c} className={`h-5 w-3.5 rounded-sm ${c}`} />
            ))}
          </div>
        </div>
        <div className="rounded-md border border-border bg-card p-2 shadow-sm">
          <span className="text-[8px] font-black tracking-widest text-foreground">YOUR BRAND</span>
          <SceneBar className="mt-1 h-1 w-[60%]" />
          <SceneBar className="mt-0.5 h-1 w-[42%]" />
        </div>
      </div>
    </Frame>
  );
}

/** Restaurant menu: printed menu + mobile menu. */
export function MenuScene() {
  return (
    <Frame>
      <div className="absolute inset-0 grid grid-cols-[1.2fr_0.8fr] gap-3 p-4">
        <div className="rounded-md border border-border bg-card p-2 shadow-sm">
          <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.2em] text-primary">
            <Utensils size={8} /> Menu
          </span>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="mt-1.5 flex items-center gap-1.5">
              <span className="h-3.5 w-4 rounded-sm bg-foreground/10" />
              <SceneBar className="h-1 flex-1" />
              <SceneBar tone="primary" className="h-1 w-3" />
            </div>
          ))}
        </div>
        <div className="self-center overflow-hidden rounded-lg border border-border bg-card shadow-md">
          <div className="h-8 bg-secondary" />
          <div className="space-y-1 p-1.5">
            <SceneBar className="h-1 w-full" />
            <SceneBar className="h-1 w-[70%]" />
            <SceneBar tone="primary" className="h-2 w-full rounded" />
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** Local visibility (QMAPS): listing + map + directory nodes. */
export function LocalScene() {
  return (
    <Frame>
      <div className="absolute inset-0 p-4">
        <div className="relative h-full overflow-hidden rounded-lg bg-secondary/70">
          <svg viewBox="0 0 160 90" className="absolute inset-0 h-full w-full text-foreground/15" preserveAspectRatio="none">
            <path d="M0 26 H160 M0 60 H160 M40 0 V90 M104 0 V90" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
          <span className="absolute left-[40%] top-[34%]">
            <span className="absolute -inset-3 rounded-full bg-primary/25" />
            <MapPin size={16} className="relative text-primary" />
          </span>
          {[
            { x: "14%", y: "70%" },
            { x: "74%", y: "24%" },
            { x: "80%", y: "72%" },
          ].map((n) => (
            <span key={n.x} style={{ left: n.x, top: n.y }} className="absolute h-1.5 w-1.5 rounded-full bg-primary/60" />
          ))}
          <span className="absolute bottom-2 left-2 rounded-md border border-border bg-background/90 px-2 py-1 backdrop-blur">
            <span className="text-[8px] font-black uppercase tracking-[0.18em] text-primary">QMAPS</span>
            <SceneBar className="mt-1 h-1 w-14" />
          </span>
          <SceneChip className="absolute right-2 top-2 text-primary">
            <Check size={8} /> Listing consistent
          </SceneChip>
        </div>
      </div>
    </Frame>
  );
}

/** Social starter: calendar + post preview + approval. */
export function SocialScene() {
  return (
    <Frame>
      <div className="absolute inset-0 grid grid-cols-[1fr_0.9fr] gap-3 p-4">
        <div className="rounded-lg border border-border bg-card p-2">
          <span className="flex items-center gap-1 text-[8px] font-semibold text-foreground">
            <Calendar size={9} className="text-primary" /> Content calendar
          </span>
          <div className="mt-1.5 grid grid-cols-7 gap-[3px]">
            {Array.from({ length: 21 }).map((_, i) => (
              <span key={i} className={`h-2 rounded-[2px] ${i % 5 === 2 ? "bg-primary/80" : "bg-foreground/10"}`} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex h-8 items-center justify-center bg-secondary">
              <ImageIcon size={12} className="text-foreground/30" />
            </div>
            <div className="space-y-1 p-1.5">
              <SceneBar className="h-1 w-[80%]" />
              <SceneBar className="h-1 w-[55%]" />
            </div>
          </div>
          <SceneChip className="text-primary">Scheduled</SceneChip>
        </div>
      </div>
    </Frame>
  );
}

/** Lead funnel (FLEXS): source → inquiry → opportunity → pipeline. */
export function LeadScene() {
  return (
    <Frame>
      <div className="absolute inset-0 flex flex-col justify-center gap-2 p-4">
        <span className="text-[8px] font-black uppercase tracking-[0.18em] text-primary">FLEXS</span>
        {[
          { w: "100%", label: "Traffic source" },
          { w: "78%", label: "Inquiry" },
          { w: "56%", label: "Opportunity" },
          { w: "38%", label: "Pipeline" },
        ].map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <span
              style={{ width: s.w, opacity: 1 - i * 0.12 }}
              className="flex h-6 items-center rounded-md border border-primary/30 bg-primary/10 px-2 text-[9px] font-semibold text-foreground"
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** Automation: trigger → condition → action → complete. */
export function AutomationScene() {
  return (
    <Frame>
      <div className="absolute inset-0 flex flex-col justify-center gap-2 p-4">
        {[
          { icon: Phone, label: "Trigger" },
          { icon: Zap, label: "Condition" },
          { icon: Zap, label: "Action" },
          { icon: Check, label: "Complete" },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-border bg-card">
                <Icon size={11} className="text-primary" />
              </span>
              <span className="text-[9px] font-semibold text-foreground">{s.label}</span>
              <SceneBar tone={i === 3 ? "primary" : "muted"} className="ml-auto h-1 w-10" />
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

/** Brand kit: mark, type, colors, applications. */
export function BrandKitScene() {
  return (
    <Frame>
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-2 p-4">
        <span className="grid place-items-center rounded-lg bg-primary text-[11px] font-black text-primary-foreground">TK</span>
        <span className="grid place-items-center rounded-lg border border-border bg-card text-[13px] font-black text-foreground">Aa</span>
        <span className="flex items-end gap-1 rounded-lg border border-border bg-card p-1.5">
          {["bg-primary", "bg-primary/60", "bg-foreground/60", "bg-foreground/20"].map((c) => (
            <span key={c} className={`h-full w-2 rounded-sm ${c}`} />
          ))}
        </span>
        <span className="rounded-lg border border-border bg-card p-1.5">
          <SceneBar tone="primary" className="h-1 w-5" />
          <SceneBar className="mt-1 h-1 w-full" />
          <SceneBar className="mt-0.5 h-1 w-[70%]" />
        </span>
        <span className="rounded-lg border border-border bg-secondary/60 p-1.5">
          <span className="text-[7px] font-black tracking-widest text-foreground">CARD</span>
          <SceneBar className="mt-1 h-1 w-[60%]" />
        </span>
        <span className="grid place-items-center rounded-lg border border-border bg-card">
          <span className="h-5 w-5 rounded-full border border-primary/40" />
        </span>
      </div>
    </Frame>
  );
}
