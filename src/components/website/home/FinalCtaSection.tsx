"use client";

import { Link } from "@/lib/website/nav";
import { ArrowRight, Headset, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import { openLiveChat } from "@/lib/website/chat-provider";
import { Reveal } from "./Reveal";

export function FinalCtaSection() {
  const { t } = useLanguage();
  return (
    <section className="brand-dark relative overflow-hidden border-t border-border">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(700px 300px at 50% -20%, color-mix(in oklab, var(--brand-accent-cyan) 22%, transparent), transparent 60%), radial-gradient(700px 300px at 50% 120%, color-mix(in oklab, var(--brand-accent-violet) 22%, transparent), transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-4xl px-4 py-20 text-center">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-foreground/85">
            <Sparkles size={12} className="text-primary" /> {t("home.final.badge")}
          </span>
          <h2 className="mt-5 text-3xl font-bold leading-tight text-foreground md:text-5xl">{t("home.final.title")}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">{t("home.final.subtitle")}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/marketplace"
              className="tk-glow-cta inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-primary-foreground"
              style={{ backgroundImage: "var(--gradient-hero)" }}
            >
              {t("home.final.cta1")} <ArrowRight size={16} />
            </Link>
            <Link
              to="/services"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-foreground hover:bg-white/10"
            >
              {t("home.final.cta2")}
            </Link>
            <button
              type="button"
              onClick={() => openLiveChat({ page: "/" })}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-foreground/85 underline-offset-4 hover:text-foreground hover:underline"
            >
              <Headset size={15} className="text-primary" /> {t("home.final.cta3")}
            </button>
          </div>
          <p className="mt-7 text-sm font-medium text-foreground/80">{t("home.final.close")}</p>
        </Reveal>
      </div>
    </section>
  );
}
