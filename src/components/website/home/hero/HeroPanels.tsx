"use client";

import { Globe, Server, Monitor, MapPin, UserPlus, PhoneCall, Workflow, LayoutDashboard } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import { HeroObject, ObjectHeader } from "./HeroObject";
import type { HeroStep } from "./heroStory";

export interface PanelProps {
  step: HeroStep;
  reached: boolean;
  current: boolean;
  selected: boolean;
  onEnter: () => void;
  onLeave: () => void;
  /** How far the story has progressed overall, for chained sub-states. */
  progress: number;
  compact?: boolean;
}

const line = (on: boolean) =>
  on ? "text-foreground" : "text-muted-foreground/70";

const dot = (on: boolean) =>
  `h-1.5 w-1.5 rounded-full ${on ? "bg-primary" : "bg-white/25"}`;

/* ------------------------------------------------------------------ */
/* Domain + hosting foundation                                         */
/* ------------------------------------------------------------------ */
export function FoundationPanel(p: PanelProps) {
  const { tx } = useLanguage();
  const rows = [
    { k: "dns", label: { en: "DNS", fr: "DNS" }, at: 1 },
    { k: "host", label: { en: "Hosting", fr: "Hébergement" }, at: 2 },
    { k: "ssl", label: { en: "SSL", fr: "SSL" }, at: 2 },
  ];
  return (
    <HeroObject {...p} depth="back" className="relative w-full">
      <ObjectHeader icon={Globe} title={tx(p.step.label)} meta="brand.ca · brand.com" active={p.reached} />
      <span className="mt-2 block px-3">
        <span className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5">
          <span className="font-mono text-[11px] text-foreground">brand.ca</span>
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-primary">
            {tx({ en: "Demo state", fr: "État démo" })}
          </span>
        </span>
        {!p.compact && (
          <span className="mt-2 grid grid-cols-3 gap-1.5">
            {rows.map((r) => (
              <span
                key={r.k}
                className={`flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] ${line(p.progress > r.at)}`}
              >
                <span className={dot(p.progress > r.at)} />
                {tx(r.label)}
              </span>
            ))}
          </span>
        )}
      </span>
    </HeroObject>
  );
}

/* ------------------------------------------------------------------ */
/* Hosting                                                             */
/* ------------------------------------------------------------------ */
export function HostingPanel(p: PanelProps) {
  const { tx } = useLanguage();
  return (
    <HeroObject {...p} depth="back" className="relative w-full">
      <ObjectHeader
        icon={Server}
        title={tx(p.step.label)}
        meta={tx({ en: "Canadian region · Backups", fr: "Région canadienne · Sauvegardes" })}
        active={p.reached}
      />
      {!p.compact && (
        <span className="mt-2 block px-3">
          <span className="flex gap-1">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <span
                key={i}
                className={`h-6 flex-1 rounded-[3px] ${p.reached && i < 6 ? "bg-primary/45" : "bg-white/10"}`}
              />
            ))}
          </span>
        </span>
      )}
    </HeroObject>
  );
}

/* ------------------------------------------------------------------ */
/* Website mockup                                                      */
/* ------------------------------------------------------------------ */
export function WebsitePanel(p: PanelProps) {
  const { tx } = useLanguage();
  const designed = p.progress > 3;
  return (
    <HeroObject {...p} depth="mid" className="relative w-full">
      <ObjectHeader
        icon={Monitor}
        title={tx(p.step.label)}
        meta={tx({ en: "Wireframe → designed → live", fr: "Maquette → conçu → en ligne" })}
        active={p.reached}
      />
      <span className="mt-2 block px-3">
        <span className="block overflow-hidden rounded-lg border border-white/10 bg-[color-mix(in_oklab,var(--background)_70%,black)]">
          {/* browser chrome */}
          <span className="flex items-center gap-1.5 border-b border-white/10 bg-white/[0.04] px-2 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
            <span className="ml-1 truncate font-mono text-[9px] text-muted-foreground">https://brand.ca</span>
          </span>
          {/* site body */}
          <span className="block p-2">
            <span className="flex items-center justify-between">
              <span className="h-1.5 w-10 rounded-full bg-primary/70" />
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1 w-5 rounded-full bg-white/20" />
                ))}
              </span>
            </span>
            <span
              className={`mt-2 block rounded-md ${designed ? "bg-[linear-gradient(120deg,color-mix(in_oklab,var(--primary)_28%,transparent),transparent)]" : "bg-white/[0.06]"} p-2`}
            >
              <span className="block h-1.5 w-2/3 rounded-full bg-white/45" />
              <span className="mt-1.5 block h-1 w-1/2 rounded-full bg-white/20" />
              <span className="mt-2 block h-3 w-16 rounded-[4px] bg-primary/70" />
            </span>
            {!p.compact && (
              <span className="mt-2 grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="block rounded-md border border-white/10 bg-white/[0.04] p-1.5">
                    <span className={`block h-5 rounded-[3px] ${designed ? "bg-white/12" : "bg-white/[0.06]"}`} />
                    <span className="mt-1 block h-1 w-3/4 rounded-full bg-white/20" />
                  </span>
                ))}
              </span>
            )}
          </span>
        </span>
      </span>
    </HeroObject>
  );
}

/* ------------------------------------------------------------------ */
/* QMAPS visibility                                                    */
/* ------------------------------------------------------------------ */
export function VisibilityPanel(p: PanelProps) {
  const { tx } = useLanguage();
  return (
    <HeroObject {...p} depth="mid" className="relative w-full">
      <ObjectHeader
        icon={MapPin}
        title="QMAPS"
        meta={tx({ en: "Local discovery", fr: "Découverte locale" })}
        active={p.reached}
      />
      <span className="mt-2 block px-3">
        <span className="relative block h-[76px] overflow-hidden rounded-lg border border-white/10 bg-black/30">
          <svg viewBox="0 0 200 90" className="absolute inset-0 h-full w-full text-white/12" aria-hidden>
            <path d="M0 20 H200 M0 46 H200 M0 72 H200 M40 0 V90 M92 0 V90 M148 0 V90" stroke="currentColor" strokeWidth="1" fill="none" />
            <path d="M40 72 L92 46 L148 20" stroke="var(--brand-accent-cyan)" strokeOpacity="0.55" strokeWidth="1.5" fill="none" strokeDasharray="5 6" className={p.reached ? "tk-flow-dash" : undefined} />
          </svg>
          <span
            className={`absolute left-[44%] top-[38%] grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border ${
              p.reached ? "border-primary/60 bg-primary/25 text-primary" : "border-white/20 bg-white/10 text-foreground/60"
            }`}
          >
            <MapPin size={12} aria-hidden />
          </span>
          {p.reached && (
            <span className="absolute bottom-1.5 right-1.5 rounded-md border border-white/12 bg-black/55 px-1.5 py-1 text-[9px] text-foreground/85">
              {tx({ en: "Found nearby", fr: "Trouvé à proximité" })}
            </span>
          )}
        </span>
      </span>
    </HeroObject>
  );
}

/* ------------------------------------------------------------------ */
/* FLEXS opportunity                                                   */
/* ------------------------------------------------------------------ */
export function OpportunityPanel(p: PanelProps) {
  const { tx } = useLanguage();
  return (
    <HeroObject {...p} depth="front" className="relative w-full">
      <ObjectHeader
        icon={UserPlus}
        title="FLEXS"
        meta={tx({ en: "Source: website form", fr: "Source : formulaire du site" })}
        active={p.reached}
      />
      <span className="mt-2 block px-3">
        <span className="grid grid-cols-3 gap-1.5 text-[9.5px]">
          {[
            { en: "New", fr: "Nouveau" },
            { en: "Contacted", fr: "Contacté" },
            { en: "Won", fr: "Gagné" },
          ].map((s, i) => (
            <span
              key={s.en}
              className={`rounded-md border px-1.5 py-1 text-center ${
                p.reached && i === 0
                  ? "border-primary/45 bg-primary/15 text-primary"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground"
              }`}
            >
              {tx(s)}
            </span>
          ))}
        </span>
      </span>
    </HeroObject>
  );
}

/* ------------------------------------------------------------------ */
/* Business phone                                                      */
/* ------------------------------------------------------------------ */
export function CallPanel(p: PanelProps) {
  const { tx } = useLanguage();
  return (
    <HeroObject {...p} depth="front" className="relative w-full">
      <ObjectHeader
        icon={PhoneCall}
        title={tx({ en: "Incoming business call", fr: "Appel d'affaires entrant" })}
        meta={tx({ en: "Routing → Connected", fr: "Acheminement → Connecté" })}
        active={p.reached}
      />
      <span className="mt-2 block px-3">
        <span className="flex items-center gap-1.5">
          {[
            { en: "Caller", fr: "Appelant" },
            { en: "Routing", fr: "Acheminement" },
            { en: "Team", fr: "Équipe" },
          ].map((s, i) => (
            <span key={s.en} className="flex flex-1 items-center gap-1.5">
              <span className={`flex-1 rounded-md border px-1.5 py-1 text-center text-[9.5px] ${p.reached ? "border-primary/35 bg-primary/10 text-foreground" : "border-white/10 bg-white/[0.03] text-muted-foreground"}`}>
                {tx(s)}
              </span>
              {i < 2 && <span className={`h-px w-2 ${p.reached ? "bg-primary/60" : "bg-white/15"}`} />}
            </span>
          ))}
        </span>
      </span>
    </HeroObject>
  );
}

/* ------------------------------------------------------------------ */
/* Automation                                                          */
/* ------------------------------------------------------------------ */
export function AutomationPanel(p: PanelProps) {
  const { tx } = useLanguage();
  const steps = [
    { en: "Trigger", fr: "Déclencheur" },
    { en: "Condition", fr: "Condition" },
    { en: "Action", fr: "Action" },
  ];
  return (
    <HeroObject {...p} depth="front" className="relative w-full">
      <ObjectHeader icon={Workflow} title={tx(p.step.label)} active={p.reached} />
      <span className="mt-2 block px-3">
        <span className="flex items-center gap-1">
          {steps.map((s, i) => (
            <span key={s.en} className="flex flex-1 items-center gap-1">
              <span className={`flex-1 rounded-[5px] border px-1 py-1 text-center text-[9px] ${p.reached ? "border-primary/35 bg-primary/12 text-foreground" : "border-white/10 bg-white/[0.03] text-muted-foreground"}`}>
                {tx(s)}
              </span>
              {i < steps.length - 1 && <span className={`h-px w-2 ${p.reached ? "bg-primary/60" : "bg-white/15"}`} />}
            </span>
          ))}
        </span>
      </span>
    </HeroObject>
  );
}

/* ------------------------------------------------------------------ */
/* TAKATAK workspace — the visual anchor                               */
/* ------------------------------------------------------------------ */
export function WorkspacePanel(p: PanelProps) {
  const { tx } = useLanguage();
  const nav = [
    { en: "Overview", fr: "Aperçu" },
    { en: "Services", fr: "Services" },
    { en: "Projects", fr: "Projets" },
    { en: "Activity", fr: "Activité" },
  ];
  const services = [
    { label: { en: "Website", fr: "Site web" }, at: 3 },
    { label: { en: "Domain", fr: "Domaine" }, at: 1 },
    { label: { en: "Hosting", fr: "Hébergement" }, at: 2 },
    { label: { en: "QMAPS", fr: "QMAPS" }, at: 4 },
    { label: { en: "FLEXS", fr: "FLEXS" }, at: 5 },
    { label: { en: "Phone", fr: "Téléphonie" }, at: 6 },
    { label: { en: "Automation", fr: "Automatisation" }, at: 7 },
  ];
  return (
    <HeroObject {...p} depth="mid" className="tk-hero-anchor relative w-full">
      <ObjectHeader
        icon={LayoutDashboard}
        title={tx(p.step.label)}
        meta={tx({ en: "Progress · Approvals · Support", fr: "Progrès · Approbations · Soutien" })}
        active={p.reached}
      />
      <span className="mt-2 block px-3">
        <span className="grid grid-cols-[86px_1fr] gap-2 rounded-lg border border-white/10 bg-black/25 p-2">
          {/* sidebar */}
          <span className="hidden flex-col gap-1 sm:flex">
            {nav.map((n, i) => (
              <span
                key={n.en}
                className={`truncate rounded-md px-2 py-1 text-[10px] ${i === 0 ? "bg-primary/18 text-primary" : "text-muted-foreground"}`}
              >
                {tx(n)}
              </span>
            ))}
          </span>
          {/* main */}
          <span className="block min-w-0">
            <span className="flex items-center justify-between">
              <span className="truncate text-[11px] font-semibold text-foreground">
                {tx({ en: "Business setup", fr: "Configuration d'entreprise" })}
              </span>
              <span className="text-[9px] text-muted-foreground">
                {tx({ en: "Updated just now", fr: "Mis à jour à l'instant" })}
              </span>
            </span>
            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-700"
                style={{ width: `${Math.round((p.progress / 8) * 100)}%` }}
              />
            </span>
            <span className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
              {services.map((s) => {
                const on = p.progress >= s.at;
                return (
                  <span
                    key={s.label.en}
                    className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-[9.5px] ${
                      on ? "border-primary/30 bg-primary/10 text-foreground" : "border-white/10 bg-white/[0.03] text-muted-foreground"
                    }`}
                  >
                    <span className={dot(on)} />
                    <span className="truncate">{tx(s.label)}</span>
                  </span>
                );
              })}
            </span>
          </span>
        </span>
      </span>
    </HeroObject>
  );
}