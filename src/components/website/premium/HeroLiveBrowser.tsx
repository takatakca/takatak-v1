"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Mic, MicOff, RotateCw, Search } from "lucide-react";

import { GuidedAssistantPanel } from "@/components/website/home/GuidedAssistantPanel";
import { speechLocale } from "@/lib/website/i18n";
import { resolveIntent, searchSuggestions, searchSuggestionsFr, trackEvent, type IntentMatch } from "@/lib/website/service-intent";
import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";
import { LiveScreen, type Scene, type Step } from "./LiveScenes";

type Lang = "fr" | "en";

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
  // What the scene is about; the label follows the page language.
  const [source, setSource] = useState(DEMO[0].en);
  const business = businessOf(source, lang);
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
  const play = (s: Scene, text: string) => {
    clearTimers();
    setScene(s);
    setSource(text);
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
    play(sceneFor(match.intent), text);
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
    const id = window.setTimeout(() => play(sceneFor(resolveIntent(q).intent), q), 450);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

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
    play(sceneFor(match.intent), text);
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
              <LiveScreen scene={scene} step={step} business={business} lang={lang} />
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
