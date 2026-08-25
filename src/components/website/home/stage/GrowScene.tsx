"use client";

import { ArrowUpRight, MapPin, Megaphone, Target } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import { FLEXS, QMAPS, externalLinkProps } from "@/lib/website/product-destinations";
import { Panel, Plane, StageBadge, StepRow } from "./stageParts";

/**
 * Grow world: marketing activates, QMAPS makes the business discoverable and
 * FLEXS captures the opportunity that discovery creates.
 */
export function GrowScene({ beat }: { beat: number; animated?: boolean }) {
  const { tx, lang } = useLanguage();
  const qm = lang === "fr" ? QMAPS.fr : QMAPS.en;
  const fx = lang === "fr" ? FLEXS.fr : FLEXS.en;

  return (
    <div className="relative min-h-[420px] md:min-h-[520px]">
      {/* Background plane — local market map */}
      <Plane depth={0} shown className="relative z-10 md:absolute md:inset-x-0 md:top-0 md:h-[62%]">
        <div className="relative h-40 overflow-hidden rounded-2xl border border-white/12 bg-[color-mix(in_oklab,var(--brand-dark-2)_88%,transparent)] md:h-full">
          <svg viewBox="0 0 400 200" className="absolute inset-0 h-full w-full text-primary" aria-hidden preserveAspectRatio="none">
            {[30, 80, 130, 180].map((y) => (
              <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="currentColor" strokeOpacity="0.12" />
            ))}
            {[60, 140, 220, 300, 360].map((x) => (
              <line key={x} x1={x} y1="0" x2={x} y2="200" stroke="currentColor" strokeOpacity="0.12" />
            ))}
            <circle cx="220" cy="80" r={beat >= 2 ? 46 : 0} fill="currentColor" fillOpacity="0.08" className="transition-all duration-700" />
            <path
              d="M 60 170 C 140 150, 180 120, 220 82"
              fill="none"
              stroke="currentColor"
              strokeOpacity={beat >= 3 ? 0.55 : 0.15}
              strokeDasharray="5 6"
              className={beat >= 3 ? "tk-flow-dash" : undefined}
            />
          </svg>
          <span className="absolute left-3 top-3 rounded-full border border-white/12 bg-black/35 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {tx({ en: "Local market", fr: "Marché local" })}
          </span>
        </div>
      </Plane>

      {/* Marketing plane */}
      <Plane depth={1} shown={beat >= 1} className="relative z-20 mt-4 md:absolute md:left-0 md:top-[8%] md:mt-0 md:w-[36%]">
        <Panel
          title={tx({ en: "Campaign", fr: "Campagne" })}
          active={beat >= 1}
          meta={<Megaphone size={13} className="text-primary" aria-hidden />}
        >
          <div className="grid gap-1.5">
            <StepRow label={tx({ en: "Campaign prepared", fr: "Campagne préparée" })} reached={beat >= 1} current={beat === 1} />
            <StepRow label={tx({ en: "Content scheduled", fr: "Contenu planifié" })} reached={beat >= 1} />
            <StepRow label={tx({ en: "Local action live", fr: "Action locale active" })} reached={beat >= 2} current={beat === 2} />
          </div>
          <div className="mt-2.5 grid grid-cols-7 gap-1">
            {Array.from({ length: 14 }).map((_, i) => (
              <span key={i} className={`h-3 rounded-sm ${beat >= 1 && i % 3 === 0 ? "bg-primary/50" : "bg-white/[0.08]"}`} />
            ))}
          </div>
        </Panel>
      </Plane>

      {/* QMAPS plane */}
      <Plane depth={1} shown={beat >= 2} className="relative z-30 mt-4 md:absolute md:right-[4%] md:top-[2%] md:mt-0 md:w-[38%]">
        <Panel title="QMAPS" active={beat >= 2} meta={<MapPin size={13} className="text-primary" aria-hidden />}>
          <div className="flex items-start gap-2.5">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-primary/45 bg-primary/15 text-primary ${beat >= 2 ? "tk-blink" : ""}`}>
              <MapPin size={15} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-foreground/90">{tx({ en: "Your business profile", fr: "Votre fiche d'entreprise" })}</p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{tx({ en: "Hours · Photos · Services · Reviews", fr: "Heures · Photos · Services · Avis" })}</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-primary transition-all duration-700" style={{ width: beat >= 3 ? "92%" : beat >= 2 ? "58%" : "12%" }} />
              </div>
            </div>
          </div>
          <a
            href={QMAPS.productUrl}
            {...externalLinkProps}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/20"
          >
            {qm.open} <ArrowUpRight size={12} aria-hidden />
          </a>
        </Panel>
      </Plane>

      {/* FLEXS foreground plane */}
      <Plane depth={2} shown={beat >= 4} className="relative z-40 mt-4 md:absolute md:bottom-0 md:left-[10%] md:mt-0 md:w-[52%]">
        <Panel title="FLEXS" active={beat >= 4} meta={<Target size={13} className="text-primary" aria-hidden />}>
          <div className="grid gap-1.5 sm:grid-cols-2">
            <StepRow label={tx({ en: "Inquiry received", fr: "Demande reçue" })} reached={beat >= 4} current={beat === 4} />
            <StepRow label={tx({ en: "New opportunity", fr: "Nouvelle occasion" })} reached={beat >= 5} current={beat === 5} />
            <StepRow label={tx({ en: "Qualification", fr: "Qualification" })} reached={beat >= 6} current={beat === 6} />
            <StepRow label={tx({ en: "Follow-up planned", fr: "Suivi planifié" })} reached={beat >= 6} />
          </div>
          <a
            href={FLEXS.productUrl}
            {...externalLinkProps}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/20"
          >
            {fx.open} <ArrowUpRight size={12} aria-hidden />
          </a>
        </Panel>
      </Plane>

      <div className="pointer-events-none relative z-50 mt-4 flex flex-wrap gap-2 md:absolute md:bottom-[6%] md:right-0 md:mt-0 md:flex-col md:items-end">
        <StageBadge shown={beat >= 3} tone="progress">
          {tx({ en: "Customer discovers you", fr: "Un client vous découvre" })}
        </StageBadge>
        <StageBadge shown={beat >= 5} tone="done">
          {tx({ en: "New opportunity", fr: "Nouvelle occasion" })}
        </StageBadge>
      </div>
    </div>
  );
}