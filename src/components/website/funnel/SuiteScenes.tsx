"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, MapPin, Search, Send, Star, Wrench, Zap } from "lucide-react";

import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";
import { useSeen } from "./primitives";

type Lang = "fr" | "en";

function useBeat(count: number, ms: number) {
  const reduced = useReducedMotion();
  const { ref, seen } = useSeen<HTMLDivElement>();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduced || !seen) return;
    const t = window.setInterval(() => setN((v) => (v + 1) % count), ms);
    return () => window.clearInterval(t);
  }, [reduced, seen, count, ms]);
  return { ref, n: reduced ? count - 1 : n, reduced };
}

const QMAPS_RESULTS = [
  { fr: "Café du Quartier", en: "Neighbourhood Café", cat: { fr: "Café · Plateau", en: "Café · Plateau" }, r: "4,9" },
  { fr: "Boulangerie Lune", en: "Moon Bakery", cat: { fr: "Boulangerie · Rosemont", en: "Bakery · Rosemont" }, r: "4,8" },
  { fr: "Resto Saint-Denis", en: "Saint-Denis Bistro", cat: { fr: "Restaurant · Centre-ville", en: "Restaurant · Downtown" }, r: "4,7" },
];

/** QMAPS: a local search, results appear on the map, and a business adds itself for free. */
export function QmapsScene() {
  const { lang: l } = useLanguage();
  const lang = l as Lang;
  const { ref, n } = useBeat(5, 1400);
  return (
    <div ref={ref} className="relative h-[200px] overflow-hidden rounded-2xl bg-[#E8EEF7]">
      <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice">
        <path d="M0 140 L300 80 M70 0 L130 200 M220 0 L190 200 M0 50 L300 160" stroke="#fff" strokeWidth="9" />
        <rect x="230" y="120" width="60" height="45" rx="8" fill="#CFE8D6" />
      </svg>
      {[
        { x: "62%", y: "24%" },
        { x: "78%", y: "52%" },
        { x: "48%", y: "60%" },
      ].map((p, i) => (
        <span
          key={i}
          className={`absolute transition-all duration-500 ${n > i ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"}`}
          style={{ left: p.x, top: p.y }}
        >
          <MapPin size={24} className="fill-[#1E6BFF] text-white drop-shadow" aria-hidden />
        </span>
      ))}
      <div className="absolute left-2.5 right-[42%] top-2.5 flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 text-[11px] text-slate-700 shadow">
        <Search size={12} aria-hidden /> {lang === "fr" ? "Café près de moi" : "Café near me"}
      </div>
      <ul className="absolute bottom-2.5 left-2.5 grid w-[56%] gap-1">
        {QMAPS_RESULTS.map((r, i) => (
          <li
            key={r.fr}
            className={`flex items-center justify-between rounded-lg bg-white px-2 py-1 shadow-sm transition-all duration-500 ${n > i ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0"}`}
          >
            <span className="min-w-0">
              <span className="block truncate text-[10.5px] font-bold text-slate-900">{r[lang]}</span>
              <span className="block truncate text-[9.5px] text-slate-500">{r.cat[lang]}</span>
            </span>
            <span className="ml-1 flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-slate-700">
              <Star size={10} className="fill-[#E7A008] text-[#E7A008]" aria-hidden /> {r.r}
            </span>
          </li>
        ))}
      </ul>
      <span
        className={`absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-[#1E6BFF] px-2.5 py-1 text-[10.5px] font-semibold text-white shadow-lg transition-all duration-500 ${n >= 4 ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}
      >
        <BadgeCheck size={12} aria-hidden /> {lang === "fr" ? "Votre commerce ajouté" : "Your business added"}
      </span>
      <span className="absolute right-2.5 top-2.5 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{lang === "fr" ? "Démonstration" : "Demo"}</span>
    </div>
  );
}

const REQUESTS = [
  { fr: "Chauffe-eau à remplacer", en: "Water heater to replace", where: "Laval", trade: { fr: "Plomberie", en: "Plumbing" } },
  { fr: "Peinture d'un 5 ½", en: "Paint a 3-bedroom", where: "Longueuil", trade: { fr: "Peinture", en: "Painting" } },
  { fr: "Panneau électrique 200 A", en: "200 A electrical panel", where: "Montréal", trade: { fr: "Électricité", en: "Electrical" } },
];

/** FLEXS: a customer describes a job, the request goes to the right pros. */
export function FlexsScene() {
  const { lang: l } = useLanguage();
  const lang = l as Lang;
  const { ref, n } = useBeat(6, 1300);
  const req = REQUESTS[Math.floor(n / 2) % REQUESTS.length];
  const sent = n % 2 === 1;
  return (
    <div ref={ref} className="relative h-[200px] overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#0A1630,#060D1F)] p-3">
      <span className="absolute right-2.5 top-2.5 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/60">{lang === "fr" ? "Démonstration" : "Demo"}</span>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#7FD8FF]">
        <Zap size={12} aria-hidden /> {lang === "fr" ? "Nouvelle demande" : "New request"}
      </p>
      <div key={req.fr} className="tk-fade-in mt-2 rounded-xl bg-white p-2.5">
        <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#1E6BFF]">
          <Wrench size={11} aria-hidden /> {req.trade[lang]} · {req.where}
        </p>
        <p className="mt-1 text-[13px] font-bold text-slate-900">{req[lang]}</p>
        <p className="mt-0.5 text-[10.5px] text-slate-500">{lang === "fr" ? "Photos jointes · cette semaine" : "Photos attached · this week"}</p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition-colors duration-500 ${sent ? "bg-emerald-500 text-white" : "bg-white/10 text-white/70"}`}
        >
          <Send size={11} aria-hidden /> {sent ? (lang === "fr" ? "Envoyée à 3 pros" : "Sent to 3 pros") : lang === "fr" ? "Envoi aux bons pros…" : "Sending to the right pros…"}
        </span>
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex gap-1.5">
        {["PL", "RB", "TM"].map((p, i) => (
          <span
            key={p}
            className={`flex flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10.5px] font-semibold transition-all duration-500 ${sent ? "bg-[#1E6BFF]/30 text-white ring-1 ring-[#29C3FF]/50" : "bg-white/[0.05] text-white/40"}`}
            style={{ transitionDelay: sent ? `${i * 120}ms` : "0ms" }}
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/15 font-mono text-[9px]">{p}</span>
            {lang === "fr" ? "Pro" : "Pro"} {i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

/** MIMT tile: what the phone system does, and where it starts. */
export function MimtTeaser({ fromLabel }: { fromLabel: string }) {
  const { lang: l } = useLanguage();
  const lang = l as Lang;
  const items = lang === "fr" ? ["Numéro local", "Standard", "Vidéo", "IA"] : ["Local number", "Attendant", "Video", "AI"];
  return (
    <div className="relative h-[180px] overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#0A1630,#060D1F)] p-4">
      <span aria-hidden className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#1E6BFF]/30 blur-2xl" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7FD8FF]">MIMT</p>
      <p className="hp-display mt-1 text-[30px] leading-none text-white">{fromLabel}</p>
      <ul className="mt-4 flex flex-wrap gap-1.5">
        {items.map((i) => (
          <li key={i} className="rounded-full bg-white/10 px-2.5 py-1 text-[11.5px] font-semibold text-white/80">
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
