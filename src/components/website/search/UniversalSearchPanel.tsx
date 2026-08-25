"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@/lib/website/nav";
import { ArrowRight, Mic, MicOff, Search, Sparkles, X } from "lucide-react";
import {
  intentLabel,
  resolveIntent,
  searchSuggestions,
  searchSuggestionsFr,
  trackEvent,
} from "@/lib/website/service-intent";
import { useLanguage } from "@/lib/website/use-language";
import { speechLocale } from "@/lib/website/i18n";
import { useExclusiveOverlay } from "@/lib/website/overlay-manager";

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

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}

const RECENT_KEY = "takatak:recent-searches";

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function pushRecent(q: string): string[] {
  const next = [q, ...readRecent().filter((r) => r !== q)].slice(0, 5);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

const CATEGORIES = [
  { to: "/services/websites", en: "Websites", fr: "Sites web" },
  { to: "/domain", en: "Domains", fr: "Domaines" },
  { to: "/hosting", en: "Hosting", fr: "Hébergement" },
  { to: "/services/marketing", en: "Marketing", fr: "Marketing" },
  { to: "/services/logo-branding", en: "Branding", fr: "Image de marque" },
  { to: "/services/automation", en: "Automation", fr: "Automatisation" },
] as const;

/**
 * Permanent TAKATAK service finder. Typed or spoken requests open a
 * recommendation panel beneath the header — never an unexplained redirect.
 */
export function UniversalSearchPanel({ compact = false }: { compact?: boolean }) {
  const { t, lang, tx } = useLanguage();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { open, setOpen } = useExclusiveOverlay("search");
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const suggestions = lang === "fr" ? searchSuggestionsFr : searchSuggestions;
  const examples = useMemo(
    () => [t("search.ex1"), t("search.ex2"), t("search.ex3"), t("search.ex4"), t("search.ex5")],
    [t],
  );
  const [exampleIdx, setExampleIdx] = useState(0);

  useEffect(() => {
    setVoiceSupported(Boolean(getRecognitionCtor()));
    setRecent(readRecent());
    return () => recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setExampleIdx((i) => (i + 1) % 5), 4000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  const match = submitted ? resolveIntent(submitted) : null;

  function run(value: string) {
    const text = value.trim();
    if (!text) return;
    setQuery(text);
    setSubmitted(text);
    setOpen(true);
    setRecent(pushRecent(text));
    trackEvent("universal_search", { query: text, intent: resolveIntent(text).intent });
  }

  function toggleVoice() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.lang = speechLocale[lang];
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (e) => run(e.results?.[0]?.[0]?.transcript ?? "");
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    setListening(true);
    setOpen(true);
  }

  return (
    <div ref={wrapRef} className={`relative ${compact ? "w-full" : "flex-1"}`}>
      <form
        onSubmit={(e) => { e.preventDefault(); run(query); }}
        className="flex items-stretch w-full rounded-md border border-border bg-card overflow-hidden focus-within:border-primary/60 transition-colors"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={query ? t("search.placeholder") : examples[exampleIdx]}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="universal-search-panel"
          aria-label={t("search.aria")}
          className="flex-1 bg-transparent outline-none px-3.5 py-2.5 text-sm min-w-0 text-foreground placeholder:text-muted-foreground"
        />
        {voiceSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={listening ? t("search.voiceStop") : t("search.voiceStart")}
            className={`px-2.5 transition-colors ${listening ? "text-primary animate-pulse" : "text-muted-foreground hover:text-foreground"}`}
          >
            {listening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}
        <button
          type="submit"
          className="px-3.5 bg-foreground text-background hover:opacity-90 transition-opacity flex items-center justify-center"
          aria-label={t("nav.searchOpen")}
        >
          <Search size={16} />
        </button>
      </form>

      {open && (
        <div
          id="universal-search-panel"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-popover p-4 shadow-2xl animate-scale-in"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {match ? t("searchPanel.match", { query: submitted ?? "" }) : t("searchPanel.suggested")}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("searchPanel.close")}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X size={15} />
            </button>
          </div>

          {match ? (
            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-primary" />
                <p className="text-sm font-semibold text-foreground">{intentLabel(match, lang)}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setOpen(false); void navigate({ to: match.to as never }); }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  {t("searchPanel.open")} <ArrowRight size={13} />
                </button>
                <Link
                  to="/marketplace/post-project"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
                >
                  {t("searchPanel.start")}
                </Link>
                <Link
                  to="/dashboard/support"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
                >
                  {t("searchPanel.talk")}
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => run(s.query)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground/85 hover:border-primary/50 hover:text-foreground"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {recent.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("searchPanel.recent")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {recent.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => run(r)}
                    className="rounded-md bg-secondary px-2.5 py-1 text-xs text-foreground/80 hover:text-foreground"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("searchPanel.categories")}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {CATEGORIES.map((c) => (
                <Link
                  key={c.to}
                  to={c.to}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2.5 py-1.5 text-sm text-foreground/80 hover:bg-secondary hover:text-foreground"
                >
                  {tx({ en: c.en, fr: c.fr })}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}