"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Globe2,
  Lock,
  MapPin,
  Mic,
  MicOff,
  PhoneIncoming,
  RotateCw,
  Search,
  Send,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

import { GuidedAssistantPanel } from "@/components/website/home/GuidedAssistantPanel";
import { BRAND_ICONS } from "@/lib/website/brand-icons";
import { speechLocale } from "@/lib/website/i18n";
import { resolveIntent, searchSuggestions, searchSuggestionsFr, trackEvent, type IntentMatch } from "@/lib/website/service-intent";
import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";

type Lang = "fr" | "en";
type Scene = "website" | "domain" | "social" | "reviews" | "local" | "leads" | "phone";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}

/** Which scene the screen plays for what the visitor typed. */
function sceneFor(intent: string): Scene {
  switch (intent) {
    case "domain":
    case "hosting":
      return "domain";
    case "social":
    case "marketing":
      return "social";
    case "reviews":
      return "reviews";
    case "local_visibility":
      return "local";
    case "leads":
      return "leads";
    case "voip":
      return "phone";
    default:
      return "website";
  }
}

/** A friendly label for the business in the query, never the visitor's own words. */
function businessOf(q: string, lang: Lang): string {
  const s = q.toLowerCase();
  const pick = (fr: string, en: string) => (lang === "fr" ? fr : en);
  if (/restau|resto|café|cafe|pizz|bistro|traiteur/.test(s)) return pick("Votre restaurant", "Your restaurant");
  if (/boutique|magasin|shop|store|commerce/.test(s)) return pick("Votre boutique", "Your shop");
  if (/salon|coiff|spa|beaut/.test(s)) return pick("Votre salon", "Your salon");
  if (/plomb|électri|electri|renov|rénov|construct/.test(s)) return pick("Votre entreprise de services", "Your trade business");
  return pick("Votre entreprise", "Your business");
}

const DEMO: { fr: string; en: string }[] = [
  { fr: "Je veux un site web premium pour mon restaurant", en: "I want a premium website for my restaurant" },
  { fr: "Trouver un domaine .ca pour ma boutique", en: "Find a .ca domain for my shop" },
  { fr: "Publier sur Instagram et Facebook", en: "Post on Instagram and Facebook" },
  { fr: "Plus d'avis Google pour mon salon", en: "More Google reviews for my salon" },
  { fr: "Être trouvé sur Google Maps", en: "Get found on Google Maps" },
];

/** Steps of a scene: 0 idle, 1 working, 2 built, 3 success. */
type Step = 0 | 1 | 2 | 3;

function Toast({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`absolute inset-x-4 bottom-4 flex items-center gap-2.5 rounded-2xl bg-emerald-500 px-4 py-3 text-[14px] font-semibold text-white shadow-[0_18px_40px_-14px_rgb(16_185_129/0.9)] transition-all duration-500 sm:inset-x-6 sm:bottom-5 sm:text-[15px] ${
        show ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/25">
        <Check size={14} strokeWidth={3} aria-hidden />
      </span>
      {children}
    </span>
  );
}

function Brand({ slug, size = 18 }: { slug: string; size?: number }) {
  const icon = BRAND_ICONS[slug];
  if (!icon) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill={icon.hex}>
      <path d={icon.path} />
    </svg>
  );
}

/** What the laptop screen shows for one scene. */
function Screen({ scene, step, business, lang }: { scene: Scene; step: Step; business: string; lang: Lang }) {
  const fr = lang === "fr";
  const built = step >= 2;
  if (scene === "website") {
    return (
      <div className="absolute inset-0 bg-white">
        {/* skeleton while building */}
        <div className={`absolute inset-0 grid place-items-center transition-opacity duration-500 ${built ? "opacity-0" : "opacity-100"}`}>
          <div className="grid w-[70%] gap-2">
            <span className="h-3 rounded bg-slate-100" />
            <span className="h-3 w-2/3 rounded bg-slate-100" />
            <span className={`mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100`}>
              <span className="block h-full rounded-full bg-[#1F8BFF] transition-all duration-1000" style={{ width: step >= 1 ? "100%" : "8%" }} />
            </span>
            <span className="text-center text-[12px] font-semibold text-slate-500">{fr ? "Construction de votre site…" : "Building your site…"}</span>
          </div>
        </div>
        {/* the site: poof */}
        <div className={`absolute inset-0 p-3 transition-all duration-700 sm:p-4 ${built ? "scale-100 opacity-100 blur-0" : "scale-90 opacity-0 blur-sm"}`} style={{ transitionTimingFunction: "cubic-bezier(0.3,1.5,0.4,1)" }}>
          <div className={built ? "tk-page-browse" : undefined}>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 sm:text-[12px]">
            <span>{business}</span>
            <span className="hidden gap-3 text-slate-400 sm:flex">
              <span>{fr ? "Menu" : "Menu"}</span>
              <span>{fr ? "Réserver" : "Book"}</span>
              <span>Contact</span>
            </span>
          </div>
          <div className="mt-2 h-[52%] rounded-xl bg-[linear-gradient(135deg,#0B1B3D,#1F8BFF_60%,#29C3FF)] p-3 sm:p-4">
            <p className="text-[16px] font-extrabold text-white sm:text-[22px]">{fr ? "Bienvenue chez vous" : "Welcome in"}</p>
            <span className="mt-2 block h-2 w-1/2 rounded bg-white/50" />
            <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-[10px] font-bold text-[#0B1B3D] sm:text-[11px]">{fr ? "Réserver →" : "Book →"}</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-10 rounded-lg bg-slate-100 sm:h-14" style={{ transition: "opacity 0.5s", transitionDelay: `${i * 120}ms`, opacity: built ? 1 : 0 }} />
            ))}
          </div>
          {/* More of the page, reached by the slow scroll */}
          <div className="mt-3 grid grid-cols-[1.2fr_1fr] gap-2">
            <span className="h-16 rounded-lg bg-[linear-gradient(135deg,#F59E0B33,#F59E0B11)] sm:h-20" />
            <div className="grid gap-1.5">
              <span className="h-2 rounded bg-slate-200" />
              <span className="h-2 w-4/5 rounded bg-slate-100" />
              <span className="h-2 w-3/5 rounded bg-slate-100" />
              <span className="mt-1 h-5 w-20 rounded-full bg-[#1F8BFF]/15" />
            </div>
          </div>
          </div>
        </div>
        <Toast show={step === 3}>{fr ? "Succès, vous êtes en ligne" : "Success, you are live"}</Toast>
      </div>
    );
  }
  if (scene === "domain") {
    const names = [
      { n: fr ? "votremarque.ca" : "yourbrand.ca", ok: true },
      { n: fr ? "votremarque.com" : "yourbrand.com", ok: true },
      { n: fr ? "votremarque.quebec" : "yourbrand.shop", ok: true },
    ];
    return (
      <div className="absolute inset-0 bg-white p-4 sm:p-5">
        <p className="flex items-center gap-2 text-[13px] font-bold text-slate-900 sm:text-[15px]">
          <Globe2 size={16} className="text-[#1F8BFF]" aria-hidden /> {fr ? "Domaines suggérés" : "Suggested domains"}
        </p>
        <ul className="mt-3 grid gap-2">
          {names.map((d, i) => (
            <li
              key={d.n}
              className={`flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-[12.5px] transition-all duration-500 sm:text-[14px] ${step >= 1 ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0"} ${i === 0 && step >= 2 ? "border-[#1F8BFF] bg-[#1F8BFF]/5" : ""}`}
              style={{ transitionDelay: `${i * 140}ms` }}
            >
              <span className="font-semibold text-slate-900">{d.n}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${i === 0 && step >= 2 ? "bg-[#1F8BFF] text-white" : "bg-slate-100 text-slate-600"}`}>
                {i === 0 && step >= 2 ? (fr ? "Choisi" : "Picked") : fr ? "Vérifier" : "Check"}
              </span>
            </li>
          ))}
        </ul>
        <div className={`mt-3 flex items-center gap-2 text-[12px] font-semibold text-slate-600 transition-opacity duration-500 ${step >= 2 ? "opacity-100" : "opacity-0"}`}>
          <Lock size={13} className="text-emerald-600" aria-hidden /> {fr ? "SSL et hébergement inclus dans le forfait" : "SSL and hosting in the plan"}
        </div>
        <Toast show={step === 3}>{fr ? "Domaine connecté à votre site" : "Domain connected to your site"}</Toast>
      </div>
    );
  }
  if (scene === "social") {
    const nets = ["facebook", "instagram", "tiktok"];
    return (
      <div className="absolute inset-0 bg-[#0E1729] p-4 sm:p-5">
        <div className="flex gap-2">
          {nets.map((n, i) => (
            <span
              key={n}
              className={`relative grid h-10 w-10 place-items-center rounded-xl bg-white transition-all duration-500 ${step >= 1 ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
              style={{ transitionDelay: `${i * 140}ms`, transitionTimingFunction: "cubic-bezier(0.3,1.6,0.4,1)" }}
            >
              <Brand slug={n} />
              {step >= 3 && (
                <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white">
                  <Check size={10} strokeWidth={3.5} aria-hidden />
                </span>
              )}
            </span>
          ))}
        </div>
        <div className={`mt-3 flex gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10 transition-all duration-500 ${step >= 2 ? "opacity-100" : "opacity-0"}`}>
          <span className="h-16 w-16 shrink-0 rounded-xl bg-[linear-gradient(135deg,#F59E0B,#B45309)] sm:h-20 sm:w-20" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">{business} · {fr ? "nouveau menu" : "new menu"}</p>
            <span className="mt-2 block h-1.5 rounded bg-white/15" />
            <span className="mt-1.5 block h-1.5 w-2/3 rounded bg-white/15" />
            <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-[#1F8BFF] px-3 py-1 text-[11px] font-semibold text-white">
              <Send size={11} aria-hidden /> {fr ? "Publier partout" : "Post everywhere"}
            </span>
          </div>
        </div>
        <Toast show={step === 3}>{fr ? "Publié sur vos 3 réseaux" : "Posted to your 3 networks"}</Toast>
      </div>
    );
  }
  if (scene === "reviews") {
    return (
      <div className="absolute inset-0 bg-white p-4 sm:p-5">
        <p className="flex items-center gap-2 text-[13px] font-bold text-slate-900 sm:text-[15px]">
          <Brand slug="google" size={16} /> {fr ? "Nouvel avis Google" : "New Google review"}
        </p>
        <div className="mt-2 flex gap-0.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} size={20} className={`fill-current transition-colors duration-300 ${step >= 1 ? "text-[#E7A008]" : "text-slate-200"}`} style={{ transitionDelay: `${i * 120}ms` }} aria-hidden />
          ))}
        </div>
        <div className={`mt-3 rounded-2xl bg-[#EEF3FA] p-3 transition-all duration-500 ${step >= 2 ? "opacity-100" : "opacity-0"}`}>
          <p className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#1565D8]">
            <Sparkles size={11} aria-hidden /> {fr ? "Réponse proposée par l'IA" : "Reply drafted by AI"}
          </p>
          <p className="mt-1 text-[12.5px] text-slate-800 sm:text-[13.5px]">{fr ? "Merci beaucoup, au plaisir de vous revoir bientôt !" : "Thank you so much, see you again soon!"}</p>
        </div>
        <Toast show={step === 3}>{fr ? "Réponse publiée" : "Reply posted"}</Toast>
      </div>
    );
  }
  if (scene === "local") {
    return (
      <div className="absolute inset-0 bg-[#E8EEF7]">
        <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice">
          <path d="M0 170 L400 110 M90 0 L160 250 M280 0 L240 250 M0 60 L400 210" stroke="#fff" strokeWidth="14" />
          <rect x="300" y="150" width="70" height="50" rx="8" fill="#CFE8D6" />
        </svg>
        <span className={`absolute left-[58%] top-[16%] transition-all duration-500 ${step >= 1 ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"}`}>
          <MapPin size={34} className="fill-[#1F8BFF] text-white drop-shadow-lg" aria-hidden />
        </span>
        <div className={`absolute inset-x-4 bottom-16 rounded-2xl bg-white p-3 shadow-lg transition-all duration-500 sm:bottom-20 ${step >= 2 ? "opacity-100" : "opacity-0"}`}>
          <p className="text-[13px] font-bold text-slate-900">{business}</p>
          <p className="mt-0.5 text-[11.5px] text-slate-600">
            <span className="text-[#E7A008]">★★★★★</span> · {fr ? "Ouvert · Heures des fêtes à jour" : "Open · Holiday hours updated"}
          </p>
        </div>
        <Toast show={step === 3}>{fr ? "Fiche à jour partout" : "Listing updated everywhere"}</Toast>
      </div>
    );
  }
  if (scene === "leads") {
    return (
      <div className="absolute inset-0 bg-white p-4 sm:p-5">
        <p className="flex items-center gap-2 text-[13px] font-bold text-slate-900 sm:text-[15px]">
          <Users size={16} className="text-[#1F8BFF]" aria-hidden /> {fr ? "Nouvelles demandes" : "New requests"}
        </p>
        <ul className="mt-3 grid gap-2">
          {[fr ? "Soumission · rénovation de cuisine" : "Quote · kitchen renovation", fr ? "Réservation · 6 personnes, samedi" : "Booking · 6 people, Saturday", fr ? "Question · livraison à Laval" : "Question · delivery to Laval"].map((r, i) => (
            <li
              key={r}
              className={`flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-[12.5px] text-slate-800 transition-all duration-500 sm:text-[13.5px] ${step >= 1 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
              style={{ transitionDelay: `${i * 160}ms` }}
            >
              {r}
              <span className="rounded-full bg-[#1F8BFF]/10 px-2 py-0.5 text-[10.5px] font-semibold text-[#1565D8]">{fr ? "Nouveau" : "New"}</span>
            </li>
          ))}
        </ul>
        <Toast show={step === 3}>{fr ? "Demandes ajoutées à votre CRM" : "Requests added to your CRM"}</Toast>
      </div>
    );
  }
  // phone
  return (
    <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(160deg,#0B1B3D,#060D1F)]">
      <div className="text-center">
        <span className={`mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#1F8BFF] text-white ${step === 1 ? "animate-bounce" : ""}`}>
          <PhoneIncoming size={26} aria-hidden />
        </span>
        <p className="mt-3 text-[15px] font-semibold text-white">{fr ? "Appel entrant · Ligne Ventes" : "Incoming call · Sales line"}</p>
        <p className={`mt-1 text-[13px] text-white/60 transition-opacity duration-500 ${step >= 2 ? "opacity-100" : "opacity-0"}`}>
          {fr ? "Standard : 1 Ventes · 2 Soutien · 3 Heures" : "Attendant: 1 Sales · 2 Support · 3 Hours"}
        </p>
      </div>
      <Toast show={step === 3}>{fr ? "Appel dirigé vers la bonne personne" : "Call routed to the right person"}</Toast>
    </div>
  );
}

/**
 * Hero visual: a laptop whose browser address bar is the TAKATAK search.
 * Idle, it types example requests and builds the result on screen (labelled
 * as an illustration). As soon as the visitor types, the screen follows what
 * they ask, and pressing Go opens the guided answer below.
 */
export function HeroLiveBrowser() {
  const { t, lang: l } = useLanguage();
  const lang = l as Lang;
  const reduced = useReducedMotion();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [demoIdx, setDemoIdx] = useState(0);
  const [typed, setTyped] = useState(0);
  const [step, setStep] = useState<Step>(reduced ? 3 : 0);
  const [scene, setScene] = useState<Scene>("website");
  const [business, setBusiness] = useState(businessOf(DEMO[0].fr, lang));
  const [result, setResult] = useState<{ query: string; match: IntentMatch } | null>(null);
  const [listening, setListening] = useState(false);
  const [voice, setVoice] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const timers = useRef<number[]>([]);
  const userActive = focused || query.length > 0 || result !== null;
  const suggestions = lang === "fr" ? searchSuggestionsFr : searchSuggestions;

  useEffect(() => {
    setVoice(Boolean(recognitionCtor()));
    return () => recognition.current?.stop();
  }, []);

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };

  /** Plays one scene: working, built, success. */
  const play = (s: Scene, label: string) => {
    clearTimers();
    setScene(s);
    setBusiness(label);
    if (reduced) {
      setStep(3);
      return;
    }
    setStep(0);
    timers.current.push(window.setTimeout(() => setStep(1), 150));
    timers.current.push(window.setTimeout(() => setStep(2), 1300));
    timers.current.push(window.setTimeout(() => setStep(3), 2300));
  };

  // Idle demo: type an example, build it, move to the next one.
  useEffect(() => {
    if (userActive || reduced) return;
    const text = DEMO[demoIdx][lang];
    if (typed < text.length) {
      const id = window.setTimeout(() => setTyped((n) => n + 1), 38);
      return () => window.clearTimeout(id);
    }
    const match = resolveIntent(text);
    play(sceneFor(match.intent), businessOf(text, lang));
    const next = window.setTimeout(() => {
      setStep((s) => (s === 3 ? 2 : s));
      setTyped(0);
      setDemoIdx((i) => (i + 1) % DEMO.length);
    }, 4600);
    return () => window.clearTimeout(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, demoIdx, userActive, lang, reduced]);

  // The visitor types: the screen follows (debounced).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return;
    const id = window.setTimeout(() => play(sceneFor(resolveIntent(q).intent), businessOf(q, lang)), 450);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, lang]);

  useEffect(() => () => clearTimers(), []);

  // Reduced motion: no typing, no build, the finished screen only.
  useEffect(() => {
    if (reduced) setStep(3);
  }, [reduced]);

  function go(value: string) {
    const text = value.trim();
    if (!text) return;
    const match = resolveIntent(text);
    trackEvent("home_ai_search", { query: text, intent: match.intent, destination: match.to });
    play(sceneFor(match.intent), businessOf(text, lang));
    setResult({ query: text, match });
  }

  function toggleVoice() {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }
    const r = new Ctor();
    recognition.current = r;
    r.lang = speechLocale[lang];
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const said = e.results?.[0]?.[0]?.transcript ?? "";
      setQuery(said);
      trackEvent("home_voice_search", { transcript: said });
      go(said);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    r.start();
    setListening(true);
  }

  const demoText = reduced ? DEMO[demoIdx][lang] : DEMO[demoIdx][lang].slice(0, typed);

  return (
    <div className="relative mx-auto w-full max-w-[680px] lg:max-w-none">
      {/* Browser windows drifting behind, like someone browsing */}
      <div aria-hidden className="pointer-events-none absolute -inset-10 overflow-hidden">
        <div className="absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgb(31_139_255/0.35),transparent)] blur-2xl" />
        {[
          { cls: "left-[-6%] top-[4%] w-[46%]", d: "0s" },
          { cls: "right-[-8%] top-[30%] w-[40%]", d: "-6s" },
          { cls: "left-[10%] bottom-[-4%] w-[38%]", d: "-11s" },
        ].map((w, i) => (
          <div key={i} className={`tk-ghost-window absolute ${w.cls} rounded-xl bg-white/[0.04] p-2 ring-1 ring-white/10 backdrop-blur-sm`} style={{ animationDelay: w.d }}>
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
              <span className="ml-2 h-1.5 w-1/2 rounded-full bg-white/10" />
            </div>
            <div className="mt-2 grid gap-1.5">
              <span className="h-10 rounded-md bg-[linear-gradient(135deg,rgb(31_139_255/0.25),rgb(41_195_255/0.08))]" />
              <span className="h-1.5 w-3/4 rounded bg-white/10" />
              <span className="h-1.5 w-1/2 rounded bg-white/10" />
            </div>
          </div>
        ))}
      </div>

      {/* The laptop */}
      <div className="relative">
        <div className="rounded-t-[18px] border-[9px] border-b-0 border-[#1B2436] bg-[#1B2436] shadow-[0_60px_140px_-40px_rgb(31_139_255/0.6)]">
          <div className="overflow-hidden rounded-t-[8px] bg-[#F1F4F9]">
            {/* Browser chrome: tabs + the search as the address bar */}
            <div className="flex items-end gap-1 bg-[#DCE3EE] px-2 pt-1.5">
              <span className="flex gap-1 px-1 pb-2" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
              </span>
              <span className="flex max-w-[45%] items-center gap-1.5 truncate rounded-t-lg bg-[#F1F4F9] px-3 py-1.5 text-[11px] font-semibold text-slate-700">
                <span className="grid h-3.5 w-3.5 place-items-center rounded-sm bg-[#060D1F] text-[7px] font-black text-[#29C3FF]">T</span>
                TAKATAK
              </span>
              <span className="hidden truncate rounded-t-lg px-3 py-1.5 text-[11px] text-slate-500 sm:block">{business}</span>
            </div>
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                go(query);
              }}
              className="flex items-center gap-1.5 border-b border-slate-200 bg-[#F1F4F9] px-2 py-1.5"
            >
              <RotateCw size={14} className="hidden shrink-0 text-slate-400 sm:block" aria-hidden />
              <label htmlFor="hero-live-search" className="sr-only">
                {t("home.lead.searchLabel")}
              </label>
              <div className="relative flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-[#1F8BFF]">
                <Search size={14} className="shrink-0 text-slate-400" aria-hidden />
                <input
                  id="hero-live-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder={userActive ? t("search.placeholder") : ""}
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400 sm:text-[14px]"
                />
                {!userActive && (
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 left-9 right-3 flex items-center truncate text-[13px] text-slate-500 sm:text-[14px]">
                    {demoText}
                    <span className="ml-0.5 inline-block h-4 w-[1.5px] animate-pulse bg-[#1F8BFF]" />
                  </span>
                )}
              </div>
              {voice && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  aria-label={listening ? t("search.voiceStop") : t("search.voiceStart")}
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${listening ? "animate-pulse bg-[#1F8BFF] text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-900"}`}
                >
                  {listening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
              )}
              <button type="submit" className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-[#1565D8] px-3.5 text-[13px] font-semibold text-white hover:bg-[#1F8BFF]">
                {t("search.go")} <ArrowRight size={13} aria-hidden />
              </button>
            </form>
            {/* The page the browser shows */}
            <div className="relative aspect-[16/9] overflow-hidden" aria-live="polite">
              <Screen scene={scene} step={step} business={business} lang={lang} />
            </div>
          </div>
        </div>
        <div className="relative h-4 rounded-b-[14px] bg-[linear-gradient(180deg,#C9D3E0,#8E9AAB)]">
          <span className="absolute left-1/2 top-0 h-1.5 w-24 -translate-x-1/2 rounded-b-md bg-[#7A8699]" />
        </div>
      </div>

      {/* Quick picks and the guided answer */}
      <div className="relative mt-5 flex flex-wrap gap-2">
        {suggestions.slice(0, 4).map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => {
              setQuery(s.query);
              go(s.query);
            }}
            className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[12.5px] font-medium text-white/75 ring-1 ring-white/15 transition-colors hover:bg-white/[0.12] hover:text-white"
          >
            {s.label}
          </button>
        ))}
      </div>
      {result && (
        <div className="relative">
          <GuidedAssistantPanel query={result.query} match={result.match} onDismiss={() => setResult(null)} />
        </div>
      )}
      <p className="relative mt-3 text-[10px] uppercase tracking-[0.18em] text-white/35">{t("home.p.preview")}</p>
    </div>
  );
}
