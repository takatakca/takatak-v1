"use client";

import { Link } from "@/lib/website/nav";
import { ArrowRight, Headset } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import { openLiveChat } from "@/lib/website/chat-provider";
import { Reveal } from "./Reveal";

export function FinalCtaSection() {
  const { t, lang } = useLanguage();
  return (
    <section aria-labelledby="home-final-title" className="bg-background px-4 pt-2">
      {/* Same content width as the header and footer (max-w-7xl minus their px-4). */}
      <div className="brand-dark relative mx-auto max-w-[1248px] overflow-hidden rounded-3xl border border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(700px 300px at 50% -20%, color-mix(in oklab, var(--brand-accent-cyan) 22%, transparent), transparent 60%), radial-gradient(700px 300px at 50% 120%, color-mix(in oklab, var(--brand-accent-violet) 22%, transparent), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-5 py-14 text-center md:py-20">
          <Reveal>
            <h2 id="home-final-title" className="text-balance text-3xl font-bold leading-tight text-foreground md:text-5xl">
              {t("home.final.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">{t("home.final.subtitle")}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
              <Link
                to="/marketplace/post-project"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {t("home.lead.cta")} <ArrowRight size={16} aria-hidden />
              </Link>
              <button
                type="button"
                onClick={() => openLiveChat({ page: "/", intent: "final_cta", lang })}
                className="inline-flex items-center gap-2 rounded-lg px-2 py-3 text-sm font-semibold text-foreground/90 underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Headset size={16} className="text-[var(--brand-accent-cyan)]" aria-hidden /> {t("home.final.cta3")}
              </button>
            </div>
            <p className="mt-7 text-sm font-medium text-foreground/80">{t("home.final.close")}</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
