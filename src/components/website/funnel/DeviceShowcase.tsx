"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import {
  ArrowUpRight,
  Bot,
  Globe2,
  Headset,
  LayoutTemplate,
  MapPin,
  Megaphone,
  Server,
  Share2,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";

import { openLiveChat } from "@/lib/website/chat-provider";
import { Link } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";
import { Eyebrow, Rise, Section, TwoTone, useSeen } from "./primitives";

type Lang = "fr" | "en";
type Bi = Record<Lang, string>;

/** The ten services, in the BRAND.md order. */
const SERVICES: { key: string; Icon: LucideIcon; name: Bi; line: Bi; to?: string }[] = [
  { key: "websites", Icon: LayoutTemplate, name: { fr: "Sites web", en: "Websites" }, line: { fr: "Sur mesure et SEO", en: "Custom & SEO" }, to: "/services/websites" },
  { key: "hosting", Icon: Server, name: { fr: "Hébergement", en: "Hosting" }, line: { fr: "Rapide et sécurisé", en: "Fast & secure" }, to: "/hosting" },
  { key: "domains", Icon: Globe2, name: { fr: "Domaines", en: "Domains" }, line: { fr: "Votre marque en ligne", en: "Your brand online" }, to: "/domain" },
  { key: "marketing", Icon: Megaphone, name: { fr: "Marketing", en: "Marketing" }, line: { fr: "Stratégie et publicité", en: "Strategy & ads" }, to: "/services/marketing" },
  { key: "social", Icon: Share2, name: { fr: "Réseaux sociaux", en: "Social media" }, line: { fr: "Contenu et croissance", en: "Content & growth" }, to: "/services/social-media" },
  { key: "local", Icon: MapPin, name: { fr: "Fiches locales", en: "Local listings" }, line: { fr: "Soyez trouvé", en: "Get found" }, to: "/services/local-listings" },
  { key: "crm", Icon: Users, name: { fr: "CRM et prospects", en: "CRM & leads" }, line: { fr: "Des visiteurs aux clients", en: "Turn visitors into customers" }, to: "/services/lead-generation" },
  { key: "ai", Icon: Bot, name: { fr: "Outils IA", en: "AI tools" }, line: { fr: "Travaillez plus vite", en: "Work smarter" }, to: "/takbot" },
  { key: "marketplace", Icon: Store, name: { fr: "Marketplace", en: "Marketplace" }, line: { fr: "Vendez et grandissez", en: "Sell & scale" }, to: "/marketplace" },
  { key: "support", Icon: Headset, name: { fr: "Soutien", en: "Support" }, line: { fr: "Toujours là", en: "Always here" } },
];

const T = {
  eyebrow: { fr: "Un seul tableau de bord", en: "One dashboard" },
  lead: { fr: "Tout votre commerce,", en: "Your whole business," },
  rest: { fr: "sur l'ordinateur et le cellulaire.", en: "on your computer and your phone." },
  body: {
    fr: "Ce sont les vrais écrans de TAKATAK : le tableau de bord sur l'ordinateur, TAK bot sur le cellulaire. Chaque service s'y branche.",
    en: "These are the real TAKATAK screens: the dashboard on the computer, TAK bot on the phone. Every service plugs into it.",
  },
  real: { fr: "Vraies captures de l'application TAKATAK.", en: "Real recordings of the TAKATAK app." },
} as const;

function Loop({ src, poster, className }: { src: string; poster: string; className: string }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLVideoElement>(null);
  const { ref: seenRef, seen } = useSeen<HTMLDivElement>();
  useEffect(() => {
    const v = ref.current;
    if (!v || reduced) return;
    if (seen) v.play().catch(() => undefined);
    else v.pause();
  }, [seen, reduced]);
  return (
    <div ref={seenRef} className={className}>
      <video ref={ref} className="absolute inset-0 h-full w-full object-cover object-top" poster={poster} muted loop playsInline preload="metadata">
        <source src={src} type="video/mp4" />
      </video>
    </div>
  );
}

/** A laptop and a phone showing the real TAKATAK app, then the ten services in brand order. */
export function DeviceShowcase() {
  const { lang: l } = useLanguage();
  const lang = l as Lang;
  return (
    <Section id="home-devices" labelledBy="home-devices-title" className="relative overflow-hidden bg-[#060D1F] py-20 text-white sm:py-28">
      <div aria-hidden className="hp-tech-grid opacity-60" />
      <div aria-hidden className="absolute left-1/2 top-40 h-[480px] w-[880px] -translate-x-1/2 rounded-full bg-[#1F8BFF]/20 blur-[140px]" />
      <div className="relative mx-auto max-w-7xl px-4">
        <Rise className="mx-auto max-w-3xl text-center">
          <div className="hp" data-theme="dark">
            <Eyebrow>{T.eyebrow[lang]}</Eyebrow>
            <TwoTone id="home-devices-title" lead={T.lead[lang]} rest={T.rest[lang]} size="md" />
          </div>
          <p className="mx-auto mt-5 max-w-2xl text-[16.5px] leading-8 text-white/65">{T.body[lang]}</p>
        </Rise>

        {/* Devices */}
        <Rise delay={120} className="relative mx-auto mt-14 max-w-5xl">
          {/* Laptop */}
          <div className="relative mx-auto w-[88%]">
            <div className="rounded-t-[18px] border-[10px] border-b-0 border-[#1B2436] bg-[#1B2436] shadow-[0_60px_140px_-40px_rgb(31_139_255/0.55)]">
              <Loop src="/media/product/dashboard.mp4" poster="/media/product/dashboard.jpg" className="relative aspect-[16/10] overflow-hidden rounded-t-[8px] bg-white" />
            </div>
            <div className="relative h-4 rounded-b-[14px] bg-[linear-gradient(180deg,#C9D3E0,#8E9AAB)]">
              <span className="absolute left-1/2 top-0 h-1.5 w-24 -translate-x-1/2 rounded-b-md bg-[#7A8699]" />
            </div>
          </div>
          {/* Phone */}
          <div className="absolute -bottom-6 right-0 w-[26%] min-w-[118px] max-w-[220px] sm:-right-2">
            <div className="relative overflow-hidden rounded-[28px] border-[6px] border-[#1B2436] bg-[#0B1220] shadow-[0_40px_90px_-30px_rgb(0_0_0/0.9)]">
              <span aria-hidden className="absolute left-1/2 top-1.5 z-10 h-3.5 w-14 -translate-x-1/2 rounded-full bg-black" />
              <div className="relative aspect-[390/844] bg-white">
                <Image
                  src={`/media/product/takbot-mobile-${lang}.webp`}
                  alt={lang === "fr" ? "TAK bot sur cellulaire" : "TAK bot on a phone"}
                  fill
                  sizes="220px"
                  className="object-cover object-top"
                />
              </div>
            </div>
          </div>
          {/* Floating real screenshot: reviews */}
          <div className="absolute -left-2 bottom-10 hidden w-[28%] overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8)] ring-1 ring-white/10 md:block">
            <div className="relative aspect-[4/3]">
              <Image src="/media/product/shot-reviews.webp" alt={lang === "fr" ? "Les avis dans le tableau de bord TAKATAK" : "Reviews in the TAKATAK dashboard"} fill sizes="300px" className="object-cover object-top" />
            </div>
          </div>
        </Rise>
        <p className="mt-12 text-center text-[13px] text-white/45">{T.real[lang]}</p>

        {/* Services in brand order */}
        <ul className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {SERVICES.map((s, i) => {
            const inner = (
              <>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[linear-gradient(135deg,#1F8BFF,#29C3FF)] text-white shadow-[0_10px_24px_-10px_rgb(31_139_255/0.8)]">
                  <s.Icon size={18} aria-hidden />
                </span>
                <span className="mt-3 flex items-center gap-1 text-[15px] font-semibold text-white">
                  {s.name[lang]}
                  <ArrowUpRight size={14} className="text-white/40 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" aria-hidden />
                </span>
                <span className="mt-0.5 text-[13px] text-[#B8C4D3]">{s.line[lang]}</span>
              </>
            );
            const cls = "group hp-glow flex h-full flex-col rounded-[20px] bg-white/[0.04] p-4 ring-1 ring-white/10 transition-colors hover:bg-white/[0.08] hover:ring-[#29C3FF]/40";
            return (
              <Rise as="li" key={s.key} delay={i * 50} className="hp-build">
                {s.to ? (
                  <Link to={s.to} className={cls}>
                    {inner}
                  </Link>
                ) : (
                  <button type="button" onClick={() => openLiveChat({ page: "/", intent: "support", lang })} className={`${cls} text-left`}>
                    {inner}
                  </button>
                )}
              </Rise>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
