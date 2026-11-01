"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowRight, Camera, Check, Clock, MapPin, Phone, Plus, Sparkles, Star, UtensilsCrossed } from "lucide-react";

import { money } from "@/components/website/premium/ui";
import { pricing } from "@/lib/website/pricing";
import { BRAND_ICONS } from "@/lib/website/brand-icons";
import { useHomePlan } from "@/lib/website/home-plan";
import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";
import { openConcierge } from "./OfferRail";
import { useSeen } from "./primitives";

type Lang = "fr" | "en";

/** Where TAKATAK keeps the listing up to date (brand mark when one is public). */
export const LISTING_DIRECTORIES: { key: string; name: string; icon?: string }[] = [
  { key: "google", name: "Google", icon: "google" },
  { key: "maps", name: "Google Maps", icon: "googlemaps" },
  { key: "apple", name: "Apple Plans" },
  { key: "bing", name: "Bing" },
  { key: "yelp", name: "Yelp", icon: "yelp" },
  { key: "tripadvisor", name: "Tripadvisor", icon: "tripadvisor" },
  { key: "facebook", name: "Facebook", icon: "facebook" },
  { key: "foursquare", name: "Foursquare", icon: "foursquare" },
  { key: "411", name: "411.ca" },
  { key: "pj", name: "Pages Jaunes" },
  { key: "qmaps", name: "QMAPS" },
];

const T = {
  demo: { fr: "Démonstration", en: "Demo" },
  name: { fr: "Café du Quartier", en: "Neighbourhood Café" },
  cat: { fr: "Café · Boulangerie", en: "Café · Bakery" },
  addPhoto: { fr: "Photo ajoutée", en: "Photo added" },
  menu: { fr: "Menu", en: "Menu" },
  dish: { fr: "Croissant aux amandes", en: "Almond croissant" },
  phone: "514 555-0123",
  hours: { fr: "Lun – ven · 7 h – 19 h", en: "Mon – Fri · 7 am – 7 pm" },
  special: { fr: "24 déc. · 7 h – 14 h", en: "Dec 24 · 7 am – 2 pm" },
  specialLabel: { fr: "Heures des fêtes", en: "Holiday hours" },
  address: { fr: "1234, rue Exemple, Montréal", en: "1234 Example St, Montréal" },
  editing: { fr: "Modification en cours", en: "Editing" },
  synced: { fr: "Synchronisé partout", en: "Synced everywhere" },
  endTitle: { fr: "L'IA tient votre fiche à jour, en tout temps.", en: "AI keeps your listing up to date, all the time." },
  endBody: { fr: "Avec Groupe TAKATAK. Mise en place dès", en: "With Groupe TAKATAK. Setup from" },
  add: { fr: "Ajouter à mon forfait", en: "Add to my plan" },
  ask: { fr: "Demander à l'IA", en: "Ask the AI" },
} as const;

/** 9 beats of about 1.7 s: a 15-second edit, then the end card. */
const BEATS = 9;
const BEAT_MS = 1700;

function Mark({ icon, name }: { icon?: string; name: string }) {
  const b = icon ? BRAND_ICONS[icon] : null;
  if (b) {
    return (
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden fill={b.hex}>
        <path d={b.path} />
      </svg>
    );
  }
  return <span className="font-mono text-[9px] font-bold text-slate-500">{name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase()}</span>;
}

function Row({ show, active, icon: Icon, children }: { show: boolean; active: boolean; icon: typeof Clock; children: React.ReactNode }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] transition-all duration-500 ${
        show ? "opacity-100" : "opacity-30"
      } ${active ? "bg-[#1E6BFF]/10 ring-1 ring-[#1E6BFF]/40" : ""}`}
    >
      <Icon size={14} className={active ? "text-[#1E6BFF]" : "text-slate-500"} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-slate-800">{children}</span>
      {active && <span className="h-3.5 w-[2px] animate-pulse bg-[#1E6BFF]" aria-hidden />}
      {show && !active && <Check size={13} className="text-emerald-600" aria-hidden />}
    </div>
  );
}

/**
 * A business listing being edited live: photo, menu, phone, hours, holiday
 * hours, address, then synced to every directory, then the offer.
 */
export function ListingDemo() {
  const { lang: l } = useLanguage();
  const lang = l as Lang;
  const reduced = useReducedMotion();
  const plan = useHomePlan();
  const { ref, seen } = useSeen<HTMLDivElement>("0px 0px -20% 0px");
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (reduced || !seen) return;
    const t = window.setInterval(() => setBeat((b) => (b + 1) % (BEATS + 2)), BEAT_MS);
    return () => window.clearInterval(t);
  }, [reduced, seen]);

  const b = reduced ? BEATS : beat;
  const end = b >= BEATS - 1;
  const from = pricing.local[0].amount;

  return (
    <div ref={ref} className="relative aspect-[4/5] w-full overflow-hidden rounded-[28px] bg-[#E8EEF7] shadow-[0_40px_80px_-40px_rgb(6_13_31/0.55)] sm:aspect-[16/11]">
      {/* Map behind */}
      <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 400 280" preserveAspectRatio="xMidYMid slice">
        <rect width="400" height="280" fill="#E6ECF5" />
        <path d="M0 190 L400 120 M80 0 L160 280 M270 0 L230 280 M0 70 L400 230" stroke="#fff" strokeWidth="14" />
        <path d="M0 110 L400 60 M330 0 L360 280" stroke="#fff" strokeWidth="6" />
        <rect x="290" y="150" width="70" height="50" rx="8" fill="#CFE8D6" />
      </svg>
      <span className="absolute left-[64%] top-[22%] hidden transition-all duration-700 sm:block" style={{ transform: b >= 0 && seen ? "none" : "translateY(-40px)", opacity: seen ? 1 : 0 }}>
        <MapPin size={40} className="fill-[#1E6BFF] text-white drop-shadow-lg" aria-hidden />
      </span>
      <span className="absolute right-3 top-3 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-600 backdrop-blur">{T.demo[lang]}</span>

      {/* The listing card being edited */}
      <div
        className={`absolute left-3 right-3 top-3 overflow-hidden sm:right-auto sm:w-[min(62%,330px)] rounded-2xl bg-white shadow-[0_24px_60px_-24px_rgb(6_13_31/0.5)] transition-all duration-700 sm:left-5 sm:top-5 ${end ? "scale-[0.96] opacity-40 blur-[1px]" : ""}`}
      >
        <div className="relative h-[64px] sm:h-[84px]">
          <Image src="/photos/commerce-cafe.webp" alt="" fill sizes="330px" className="object-cover" />
          <span
            className={`absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10.5px] font-semibold text-slate-800 transition-all duration-500 ${b >= 1 ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
          >
            <Camera size={11} aria-hidden /> {T.addPhoto[lang]}
          </span>
        </div>
        <div className="p-2.5 sm:p-3">
          <p className="text-[14px] font-bold text-slate-900">{T.name[lang]}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-slate-600">
            <span className="flex">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} size={12} className={`fill-current transition-colors duration-300 ${seen ? "text-[#E7A008]" : "text-slate-200"}`} style={{ transitionDelay: `${i * 120}ms` }} aria-hidden />
              ))}
            </span>
            4,9 · {T.cat[lang]}
          </p>
          <div className="mt-2 grid gap-0.5">
            <Row show={b >= 2} active={b === 2} icon={UtensilsCrossed}>
              {T.menu[lang]} · {T.dish[lang]} · {money(lang, 4.5)}
            </Row>
            <Row show={b >= 3} active={b === 3} icon={Phone}>
              {T.phone}
            </Row>
            <Row show={b >= 4} active={b === 4} icon={Clock}>
              {T.hours[lang]}
            </Row>
            <Row show={b >= 5} active={b === 5} icon={Sparkles}>
              <span className="font-semibold text-[#1E6BFF]">{T.specialLabel[lang]}</span> · {T.special[lang]}
            </Row>
            <Row show={b >= 6} active={b === 6} icon={MapPin}>
              {T.address[lang]}
            </Row>
          </div>
        </div>
      </div>

      {/* Directories light up one by one */}
      <div className={`absolute bottom-3 left-3 right-3 transition-all duration-500 sm:bottom-5 sm:left-5 sm:right-5 ${end ? "opacity-0" : "opacity-100"}`}>
        <p className={`mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold transition-colors ${b >= 7 ? "text-emerald-700" : "text-slate-500"}`}>
          {b >= 7 ? <Check size={13} aria-hidden /> : <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1E6BFF]" aria-hidden />}
          {b >= 7 ? T.synced[lang] : T.editing[lang]}
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {LISTING_DIRECTORIES.map((d, i) => (
            <li
              key={d.key}
              className={`${i > 6 ? "hidden sm:flex" : "flex"} items-center gap-1.5 rounded-full px-2 py-1 text-[10.5px] font-semibold transition-all duration-300 ${
                b >= 7 ? "bg-white text-slate-800 shadow-sm" : "bg-white/50 text-slate-400"
              }`}
              style={{ transitionDelay: b >= 7 ? `${i * 90}ms` : "0ms" }}
            >
              <Mark icon={d.icon} name={d.name} />
              {d.name}
            </li>
          ))}
        </ul>
      </div>

      {/* End card: the offer */}
      <div
        className={`absolute inset-x-4 bottom-4 rounded-2xl bg-[#060D1F]/95 p-4 text-white shadow-2xl backdrop-blur transition-all duration-700 sm:inset-x-8 sm:bottom-8 sm:p-5 ${
          end ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
        }`}
        aria-hidden={!end}
      >
        <p className="hp-display text-[19px] leading-snug sm:text-[24px]">{T.endTitle[lang]}</p>
        <p className="mt-1 text-[13.5px] text-white/70">
          {T.endBody[lang]} <span className="font-semibold text-white">{money(lang, from)}</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            tabIndex={end ? 0 : -1}
            onClick={() => plan.toggle("local")}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#060D1F]"
          >
            {plan.has("local") ? <Check size={14} aria-hidden /> : <Plus size={14} aria-hidden />} {T.add[lang]}
          </button>
          <button
            type="button"
            tabIndex={end ? 0 : -1}
            onClick={() => openConcierge({ first: lang === "fr" ? "Fiches locales et SEO local" : "Local listings and local SEO" })}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1E6BFF] px-4 py-2 text-[13px] font-semibold text-white"
          >
            <Sparkles size={14} aria-hidden /> {T.ask[lang]} <ArrowRight size={13} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
