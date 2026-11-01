"use client";

import { useEffect, useRef } from "react";
import { Check, FileText, MapPin, MousePointer2, Phone, PhoneIncoming, Pointer, Send, Sparkles, Star, Voicemail } from "lucide-react";

import { BRAND_ICONS } from "@/lib/website/brand-icons";
import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";

type Lang = "fr" | "en";
type Bi = Record<Lang, string>;

const T = {
  label: { fr: "Ce que ça fait, en direct", en: "What it does, live" },
  note: { fr: "Démonstrations animées", en: "Animated demos" },
  web: {
    tag: { fr: "Site web", en: "Website" },
    url: { fr: "www.votrecommerce.ca", en: "www.yourbusiness.ca" },
    publish: { fr: "Mettre en ligne", en: "Go live" },
    hero: { fr: "Bienvenue chez vous", en: "Welcome in" },
    done: { fr: "Succès, vous êtes en ligne", en: "Success, you are live" },
  },
  social: {
    tag: { fr: "Réseaux sociaux", en: "Social media" },
    caption: { fr: "Nouveau menu d'automne 🍂", en: "New fall menu 🍂" },
    publish: { fr: "Publier partout", en: "Post everywhere" },
    done: { fr: "Publié sur vos 3 réseaux", en: "Posted to your 3 networks" },
  },
  reviews: {
    tag: { fr: "Avis", en: "Reviews" },
    fresh: { fr: "Nouvel avis Google", en: "New Google review" },
    reply: { fr: "Merci Julie, au plaisir de vous revoir !", en: "Thank you Julie, see you soon!" },
    ai: { fr: "Réponse proposée par l'IA", en: "Reply drafted by AI" },
    done: { fr: "Réponse publiée", en: "Reply posted" },
  },
  phone: {
    tag: { fr: "Téléphonie MIMT", en: "MIMT phone" },
    ring: { fr: "Appel entrant", en: "Incoming call" },
    route: [
      { fr: "Ventes", en: "Sales" },
      { fr: "Soutien", en: "Support" },
      { fr: "Boîte vocale", en: "Voicemail" },
    ] as Bi[],
    vm: { fr: "« Bonjour, je voudrais une soumission… »", en: "“Hi, I'd like a quote…”" },
    done: { fr: "Message en texte, rappel planifié", en: "Message as text, call-back booked" },
  },
  listing: {
    tag: { fr: "Fiche locale", en: "Local listing" },
    name: { fr: "Café du Quartier", en: "Neighbourhood Café" },
    open: { fr: "Ouvert · 7 h – 19 h", en: "Open · 7 am – 7 pm" },
    holiday: { fr: "Heures des fêtes ajoutées", en: "Holiday hours added" },
    done: { fr: "Fiche à jour partout", en: "Listing updated everywhere" },
  },
  invoice: {
    tag: { fr: "Facturation", en: "Invoicing" },
    line: { fr: "Site web · forfait", en: "Website · plan" },
    send: { fr: "Envoyer", en: "Send" },
    done: { fr: "Facture payée", en: "Invoice paid" },
  },
} as const;

function Toast({ children }: { children: React.ReactNode }) {
  return (
    <span className="sc-on3 absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-xl bg-emerald-500/95 px-3 py-2 text-[12.5px] font-semibold text-white shadow-[0_12px_30px_-10px_rgb(16_185_129/0.8)]">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/25">
        <Check size={12} strokeWidth={3} aria-hidden />
      </span>
      {children}
    </span>
  );
}

function Brand({ slug, size = 18 }: { slug: string; size?: number }) {
  const icon = BRAND_ICONS[slug];
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill={icon.hex}>
      <path d={icon.path} />
    </svg>
  );
}

function WebScene({ lang }: { lang: Lang }) {
  const t = T.web;
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[14px] bg-white">
      <div className="flex items-center gap-1.5 border-b border-slate-200 px-2.5 py-2">
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="ml-1 flex-1 truncate rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-slate-700">
          <span className="sc-type" style={{ ["--n" as string]: t.url[lang].length, ["--w" as string]: `${t.url[lang].length}ch` }}>
            {t.url[lang]}
          </span>
          <span className="sc-caret" />
        </span>
      </div>
      {/* Before: an empty page and the button */}
      <div className="sc-off2 absolute inset-x-0 bottom-0 top-9 grid place-items-center">
        <div className="grid w-[70%] gap-1.5">
          <span className="h-2 rounded bg-slate-100" />
          <span className="h-2 w-2/3 rounded bg-slate-100" />
        </div>
        <span className="sc-press absolute bottom-6 rounded-full bg-[#1E6BFF] px-3.5 py-1.5 text-[11.5px] font-semibold text-white">{t.publish[lang]}</span>
      </div>
      {/* After: poof, a real-looking page */}
      <div className="sc-poof absolute inset-x-0 bottom-0 top-9 p-2.5">
        <div className="h-[56%] rounded-lg bg-[linear-gradient(135deg,#0B1B3F,#1E6BFF_60%,#29C3FF)] p-2.5">
          <p className="text-[13px] font-bold text-white">{t.hero[lang]}</p>
          <span className="mt-1.5 block h-1.5 w-1/2 rounded bg-white/50" />
          <span className="mt-2 inline-block rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-[#0B1B3F]">→</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <span className="h-8 rounded bg-slate-200" />
          <span className="h-8 rounded bg-slate-200" />
          <span className="h-8 rounded bg-slate-200" />
        </div>
      </div>
      <span className="sc-cursor" style={{ ["--fx" as string]: "220px", ["--fy" as string]: "150px", ["--tx" as string]: "140px", ["--ty" as string]: "120px" }}>
        <MousePointer2 size={20} className="fill-[#0B1220] text-white" aria-hidden />
      </span>
      <Toast>{t.done[lang]}</Toast>
    </div>
  );
}

function SocialScene({ lang }: { lang: Lang }) {
  const t = T.social;
  const nets = ["facebook", "instagram", "tiktok"];
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[14px] bg-[#0E1729] p-3">
      <div className="flex gap-2">
        {nets.map((n, i) => (
          <span key={n} className="sc-pop relative grid h-9 w-9 place-items-center rounded-xl bg-white" style={{ ["--i" as string]: i }}>
            <Brand slug={n} />
            <span className="sc-on3 absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white">
              <Check size={10} strokeWidth={3.5} aria-hidden />
            </span>
          </span>
        ))}
      </div>
      <div className="sc-on1 mt-2.5 flex gap-2.5 rounded-xl bg-white/[0.06] p-2 ring-1 ring-white/10">
        <span className="h-14 w-14 shrink-0 rounded-lg bg-[linear-gradient(135deg,#F59E0B,#B45309)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11.5px] font-semibold text-white">{t.caption[lang]}</p>
          <span className="mt-1.5 block h-1.5 rounded bg-white/15" />
          <span className="mt-1 block h-1.5 w-2/3 rounded bg-white/15" />
          <span className="sc-press mt-2 inline-flex items-center gap-1 rounded-full bg-[#1E6BFF] px-2.5 py-1 text-[10.5px] font-semibold text-white">
            <Send size={10} aria-hidden /> {t.publish[lang]}
          </span>
        </div>
      </div>
      <span className="sc-cursor" style={{ ["--fx" as string]: "230px", ["--fy" as string]: "170px", ["--tx" as string]: "105px", ["--ty" as string]: "112px" }}>
        <Pointer size={24} className="fill-white text-[#0B1220]" aria-hidden />
      </span>
      <Toast>{t.done[lang]}</Toast>
    </div>
  );
}

function ReviewScene({ lang }: { lang: Lang }) {
  const t = T.reviews;
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[14px] bg-white p-3">
      <div className="sc-pop flex items-center gap-2" style={{ ["--i" as string]: 0 }}>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100">
          <Brand slug="google" size={16} />
        </span>
        <p className="text-[12px] font-semibold text-slate-900">{t.fresh[lang]}</p>
      </div>
      <div className="mt-2 flex gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} size={18} className="sc-star fill-current" style={{ ["--i" as string]: i }} aria-hidden />
        ))}
      </div>
      <div className="sc-on2 mt-2.5 rounded-xl rounded-tl-sm bg-[#EEF3FA] p-2">
        <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#1E6BFF]">
          <Sparkles size={10} aria-hidden /> {t.ai[lang]}
        </p>
        <p className="mt-1 text-[11.5px] text-slate-800">
          <span className="sc-type2" style={{ ["--n" as string]: t.reply[lang].length, ["--w" as string]: `${t.reply[lang].length}ch` }}>
            {t.reply[lang]}
          </span>
        </p>
      </div>
      <Toast>{t.done[lang]}</Toast>
    </div>
  );
}

function PhoneScene({ lang }: { lang: Lang }) {
  const t = T.phone;
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[14px] bg-[#0E1729] p-3">
      <div className="sc-off3 flex items-center gap-2.5">
        <span className="sc-ring grid h-9 w-9 place-items-center rounded-full bg-[#1E6BFF] text-white">
          <PhoneIncoming size={16} aria-hidden />
        </span>
        <p className="text-[12.5px] font-semibold text-white">{t.ring[lang]}</p>
      </div>
      <div className="sc-on1 mt-2.5 flex flex-wrap gap-1.5">
        {t.route.map((r, i) => (
          <span key={r.fr} className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${i === 0 ? "bg-white text-[#0B1220]" : "bg-white/10 text-white/60"}`}>
            {i === 0 ? <Phone size={10} className="mr-1 inline" aria-hidden /> : null}
            {r[lang]}
          </span>
        ))}
      </div>
      <div className="sc-on2 mt-2.5 flex gap-2 rounded-xl bg-white/[0.06] p-2 ring-1 ring-white/10">
        <Voicemail size={15} className="mt-0.5 shrink-0 text-[#7FD8FF]" aria-hidden />
        <p className="text-[11.5px] italic text-white/85">{t.vm[lang]}</p>
      </div>
      <Toast>{t.done[lang]}</Toast>
    </div>
  );
}

function ListingScene({ lang }: { lang: Lang }) {
  const t = T.listing;
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[14px] bg-[#E8EEF7]">
      <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 300 200" preserveAspectRatio="none">
        <path d="M0 140 L300 90 M60 0 L120 200 M200 0 L170 200" stroke="#fff" strokeWidth="10" />
        <path d="M0 60 L300 170" stroke="#fff" strokeWidth="5" />
      </svg>
      <span className="sc-drop absolute left-[46%] top-[18%] text-[#1E6BFF]">
        <MapPin size={30} className="fill-[#1E6BFF] text-white" aria-hidden />
      </span>
      <div className="sc-on1 absolute inset-x-3 bottom-14 rounded-xl bg-white p-2.5 shadow-lg">
        <p className="text-[12.5px] font-bold text-slate-900">{t.name[lang]}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-600">
          <span className="text-[#E7A008]">★★★★★</span> 4,9 · {t.open[lang]}
        </p>
        <p className="sc-on2 mt-1 inline-flex items-center gap-1 rounded-md bg-[#1E6BFF]/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-[#1E6BFF]">{t.holiday[lang]}</p>
      </div>
      <Toast>{t.done[lang]}</Toast>
    </div>
  );
}

function InvoiceScene({ lang }: { lang: Lang }) {
  const t = T.invoice;
  const fmt = (n: number) => n.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" });
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[14px] bg-white p-3 text-slate-800">
      <p className="flex items-center gap-1.5 text-[12px] font-bold text-slate-900">
        <FileText size={13} aria-hidden /> # 1042
      </p>
      <div className="mt-2 grid gap-1 text-[11px]">
        <p className="flex justify-between">
          <span>{t.line[lang]}</span>
          <span className="tabular-nums">{fmt(100)}</span>
        </p>
        <p className="sc-on1 flex justify-between text-slate-500">
          <span>TPS 5 %</span>
          <span className="tabular-nums">{fmt(5)}</span>
        </p>
        <p className="sc-on1 flex justify-between text-slate-500">
          <span>TVQ 9,975 %</span>
          <span className="tabular-nums">{fmt(9.98)}</span>
        </p>
        <p className="sc-on1 flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900">
          <span>Total</span>
          <span className="tabular-nums">{fmt(114.98)}</span>
        </p>
      </div>
      <span className="sc-on2 sc-press mt-2 inline-flex items-center gap-1 rounded-full bg-[#1E6BFF] px-2.5 py-1 text-[10.5px] font-semibold text-white">
        <Send size={10} aria-hidden /> {t.send[lang]}
      </span>
      <Toast>{t.done[lang]}</Toast>
    </div>
  );
}

export const SCENES: { key: string; tag: Bi; Body: (p: { lang: Lang }) => React.ReactElement }[] = [
  { key: "web", tag: T.web.tag, Body: WebScene },
  { key: "social", tag: T.social.tag, Body: SocialScene },
  { key: "reviews", tag: T.reviews.tag, Body: ReviewScene },
  { key: "phone", tag: T.phone.tag, Body: PhoneScene },
  { key: "listing", tag: T.listing.tag, Body: ListingScene },
  { key: "invoice", tag: T.invoice.tag, Body: InvoiceScene },
];
const COPIES = 3;

/**
 * Six small scenes slide across the band. Each one starts as it enters on the
 * right and finishes ("You are live", "Posted") as it reaches the left;
 * scrolling the page pushes them faster. Static and finished with reduced motion.
 */
export function ScrollScenes() {
  const { lang } = useLanguage();
  const reduced = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = wrap.current;
    const el = track.current;
    if (!root || !el || reduced) return;
    const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-scene]"));
    let x = 0;
    let last = performance.now();
    let boost = 0;
    let lastY = window.scrollY;
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const vw = window.innerWidth;
      // About 7 seconds to cross the window, faster while the page scrolls.
      x += dt * ((vw + 300) / 7000 + boost);
      boost *= 0.92;
      const loop = el.scrollWidth / COPIES;
      if (loop > 0 && x >= loop) x -= loop;
      el.style.transform = `translate3d(${-x}px,0,0)`;
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        const p = 1 - (r.left + r.width / 2) / vw;
        const s = r.right < 0 || r.left > vw ? "" : p < 0.2 ? "0" : p < 0.4 ? "01" : p < 0.58 ? "012" : "0123";
        if (c.dataset.s !== s) c.dataset.s = s;
      }
      raf = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      const dy = Math.abs(window.scrollY - lastY);
      lastY = window.scrollY;
      boost = Math.min(1.6, boost + dy * 0.004);
    };
    const io = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(raf);
      if (entry.isIntersecting) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    });
    io.observe(root);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [reduced]);

  const list = reduced ? SCENES : Array.from({ length: COPIES }, () => SCENES).flat();
  return (
    <div ref={wrap} className="relative py-6" aria-label={T.label[lang]} role="region">
      <div className="mx-auto mb-3 flex max-w-7xl items-baseline justify-between gap-4 px-4">
        <p className="hp-code-eyebrow text-[12px] font-semibold uppercase tracking-[0.16em] text-[#7FD8FF]">{T.label[lang]}</p>
        <p className="text-[12px] text-white/40">{T.note[lang]}</p>
      </div>
      <div className={reduced ? "overflow-x-auto px-4" : "overflow-hidden"}>
        <div ref={track} className="flex w-max gap-4 will-change-transform">
          {list.map((s, i) => (
            <figure
              key={`${s.key}-${i}`}
              data-scene={s.key}
              data-s={reduced ? "0123" : ""}
              aria-hidden={i >= SCENES.length || undefined}
              className="sc relative w-[270px] shrink-0 rounded-[18px] bg-white/[0.04] p-2 ring-1 ring-white/10 sm:w-[300px]"
            >
              <figcaption className="mb-2 flex items-center justify-between px-1 text-[12px] font-semibold text-white/80">
                {s.tag[lang]}
                <span className="sc-live flex items-center gap-1 text-[10.5px] font-medium text-white/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#29C3FF]" /> live
                </span>
              </figcaption>
              <div className="relative h-[178px] sm:h-[196px]">
                <s.Body lang={lang} />
              </div>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
