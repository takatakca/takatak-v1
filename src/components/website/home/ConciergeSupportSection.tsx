"use client";

import { Link } from "@/lib/website/nav";
import { ArrowRight, Check, Headset, MessageSquare, Sparkles } from "lucide-react";
import { openLiveChat } from "@/lib/website/chat-provider";
import { useLanguage } from "@/lib/website/use-language";
import { Reveal } from "./Reveal";

export function ConciergeSupportSection() {
  const { t } = useLanguage();
  const scrollToSearch = () => {
    const hero = document.getElementById("tk-hero");
    hero?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => hero?.querySelector<HTMLInputElement>("input")?.focus(), 550);
  };

  return (
    <section className="brand-dark relative overflow-hidden border-y border-border">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(680px 280px at 20% 0%, color-mix(in oklab, var(--brand-accent-cyan) 20%, transparent), transparent 65%), radial-gradient(680px 280px at 85% 110%, color-mix(in oklab, var(--brand-accent-violet) 20%, transparent), transparent 65%)",
        }}
      />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-16 md:py-20 lg:grid-cols-[1.05fr_0.95fr]">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/85">
            <Headset size={12} className="text-primary" /> {t("home.support.kicker")}
          </span>
          <h2 className="mt-5 max-w-xl text-3xl font-bold leading-tight text-foreground md:text-4xl">
            {t("home.support.title")}
          </h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">{t("home.support.subtitle")}</p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => openLiveChat({ page: "/" })}
              className="tk-glow-cta inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-primary-foreground"
              style={{ backgroundImage: "var(--gradient-hero)" }}
            >
              <MessageSquare size={15} /> {t("home.support.chat")}
            </button>
            <button
              type="button"
              onClick={scrollToSearch}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-foreground hover:bg-white/10"
            >
              <Sparkles size={15} className="text-primary" /> {t("home.support.search")}
            </button>
            <Link
              to="/marketplace/post-project"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-foreground/85 underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("home.support.quote")} <ArrowRight size={14} />
            </Link>
          </div>

          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {[t("home.support.b1"), t("home.support.b2"), t("home.support.b3")].map((b) => (
              <li key={b} className="inline-flex items-center gap-1.5">
                <Check size={13} className="text-primary" /> {b}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="tk-blink inline-block h-2 w-2 rounded-full bg-primary" />
              TAKATAK
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <p className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-foreground/90">
                {t("search.ex1")}
              </p>
              <p className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-primary-foreground" style={{ backgroundImage: "var(--gradient-hero)" }}>
                {t("home.support.subtitle")}
              </p>
              <p className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-foreground/90">
                {t("search.ex3")}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
