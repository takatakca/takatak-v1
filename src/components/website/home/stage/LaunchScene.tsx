"use client";

import { Check, Lock, Server, Smartphone } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import { BrowserChrome, Panel, Plane, StageBadge, StepRow } from "./stageParts";

/**
 * Launch world: one connected digital foundation — domain and DNS at the
 * back, the TAKATAK hosting environment in the middle, the website mockup in
 * front. `beat` drives the choreography (0 = idle, 6 = complete).
 */
export function LaunchScene({ beat, animated }: { beat: number; animated: boolean }) {
  const { tx } = useLanguage();
  const site = beat >= 6 ? 3 : beat >= 5 ? 2 : beat >= 4 ? 1 : 0;
  const phases = [
    { en: "Wireframe", fr: "Filaire" },
    { en: "Design", fr: "Design" },
    { en: "Responsive", fr: "Adaptatif" },
    { en: "LIVE", fr: "EN LIGNE" },
  ];

  return (
    <div className="relative min-h-[420px] md:min-h-[520px]">
      {/* Back plane — domain / DNS architecture */}
      <Plane depth={0} shown={beat >= 1} className="relative z-10 md:absolute md:left-0 md:top-0 md:w-[50%]">
        <Panel title={tx({ en: "Domain & DNS", fr: "Domaine et DNS" })} active={beat >= 2}>
          <div className="flex items-center gap-2 rounded-lg border border-white/12 bg-black/25 px-3 py-2">
            <span className="text-[13px] font-semibold text-foreground/90">yourbusiness</span>
            <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold transition-colors duration-500 ${beat >= 1 ? "bg-primary/20 text-primary" : "bg-white/10 text-muted-foreground"}`}>.ca</span>
            {beat >= 1 && <Check size={13} className="ml-auto text-primary" aria-hidden />}
          </div>
          <div className="mt-2.5 grid gap-1.5">
            <StepRow label={tx({ en: "Domain", fr: "Domaine" })} reached={beat >= 1} current={beat === 1} />
            <StepRow label="DNS" reached={beat >= 2} current={beat === 2} />
            <StepRow label={tx({ en: "Hosting", fr: "Hébergement" })} reached={beat >= 3} current={beat === 3} />
          </div>
        </Panel>
      </Plane>

      {/* Mid plane — hosting environment */}
      <Plane depth={1} shown={beat >= 3} className="relative z-20 mt-4 md:absolute md:right-0 md:top-0 md:mt-0 md:w-[44%]">
        <Panel
          title={tx({ en: "TAKATAK hosting", fr: "Hébergement TAKATAK" })}
          active={beat >= 3}
          meta={<Server size={13} className="text-primary" aria-hidden />}
        >
          <div className="grid grid-cols-6 gap-1">
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                className={`h-2 rounded-sm transition-colors duration-500 ${beat >= 3 && i < (beat - 2) * 6 ? "bg-primary/60" : "bg-white/10"}`}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <StepRow label="SSL" reached={beat >= 3} current={beat === 3} right={<Lock size={11} className="text-primary" aria-hidden />} />
            <StepRow label={tx({ en: "Backups", fr: "Sauvegardes" })} reached={beat >= 3} />
            <StepRow label={tx({ en: "Email ready", fr: "Courriel prêt" })} reached={beat >= 4} />
            <StepRow label={tx({ en: "Server online", fr: "Serveur en ligne" })} reached={beat >= 3} />
          </div>
        </Panel>
      </Plane>

      {/* Front plane — website mockup */}
      <Plane depth={2} shown={beat >= 4} className="relative z-30 mt-4 md:absolute md:bottom-0 md:left-0 md:mt-0 md:w-[58%]">
        <BrowserChrome url="https://yourbusiness.ca">
          <div className="relative p-3.5">
            <div className="flex items-center justify-between">
              <span className="h-2.5 w-16 rounded bg-primary/50" />
              <span className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <i key={i} className="h-1.5 w-8 rounded bg-white/15" />
                ))}
              </span>
            </div>
            <div className={`mt-3 rounded-xl border transition-all duration-700 ${site >= 1 ? "border-primary/25 bg-primary/[0.08]" : "border-dashed border-white/15 bg-white/[0.02]"} p-3`}>
              <span className={`block h-3 w-2/3 rounded ${site >= 1 ? "bg-white/35" : "bg-white/15"}`} />
              <span className="mt-2 block h-2 w-1/2 rounded bg-white/15" />
              <span className={`mt-3 block h-6 w-24 rounded-md ${site >= 2 ? "bg-primary/70" : "bg-white/12"}`} />
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`h-10 rounded-lg border transition-all duration-700 ${site >= 2 ? "border-white/12 bg-white/[0.06]" : "border-dashed border-white/12 bg-transparent"}`}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              {phases.map((p, i) => (
                <span
                  key={p.en}
                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] transition-colors duration-500 ${
                    site >= i ? "bg-primary/18 text-primary" : "bg-white/[0.06] text-muted-foreground"
                  }`}
                >
                  {tx(p)}
                </span>
              ))}
            </div>
          </div>
        </BrowserChrome>
      </Plane>

      {/* Foreground accents */}
      <Plane depth={2} shown={beat >= 5} className="relative z-40 mt-4 hidden md:absolute md:bottom-[4%] md:right-[4%] md:mt-0 md:block md:w-[26%]">
        <div className={`rounded-2xl border border-white/14 bg-[color-mix(in_oklab,var(--brand-dark-2)_92%,transparent)] p-2 ${animated ? "tk-float-slow" : ""}`}>
          <div className="rounded-xl border border-white/10 bg-black/30 p-2">
            <Smartphone size={13} className="text-primary" aria-hidden />
            <span className="mt-2 block h-2 w-3/4 rounded bg-white/25" />
            <span className="mt-1.5 block h-1.5 w-1/2 rounded bg-white/12" />
            <span className={`mt-2 block h-4 w-14 rounded ${site >= 2 ? "bg-primary/60" : "bg-white/12"}`} />
          </div>
        </div>
      </Plane>

      <div className="pointer-events-none relative z-50 mt-4 flex flex-wrap gap-2 md:absolute md:right-0 md:top-[42%] md:mt-0 md:flex-col md:items-end">
        <StageBadge shown={beat >= 3} tone="done">
          <Lock size={11} aria-hidden /> SSL
        </StageBadge>
        <StageBadge shown={beat >= 6} tone="done">
          {tx({ en: "Website live", fr: "Site en ligne" })}
        </StageBadge>
        <StageBadge shown={beat >= 6} tone="progress">
          {tx({ en: "Your foundation is ready.", fr: "Votre fondation est prête." })}
        </StageBadge>
      </div>
    </div>
  );
}