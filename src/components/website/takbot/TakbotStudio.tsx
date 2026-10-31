"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Bot, Check, ChevronDown, Coins, Headset, Loader2, Moon, Search, Send, ShieldCheck, Sparkles, Sun, User } from "lucide-react";

import { MODE_ICONS } from "@/components/website/funnel/TakbotSection";
import { Aurora } from "@/components/website/funnel/primitives";
import { Kicker, money } from "@/components/website/premium/ui";
import { TAKBOT_ACTIONS, TAKBOT_ENGINES, TAKBOT_MODES, TAKBOT_PACKS, MAX_PROMPT_CHARS, creditsFor, type TakbotMode } from "@/lib/takbot/catalog";
import { takbotCopy, takbotModeCopy } from "@/lib/takbot/copy";
import { openLiveChat } from "@/lib/website/chat-provider";
import { fill } from "@/lib/website/home-funnel";
import { useHomeTheme } from "@/lib/website/home-theme";
import { Link } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";

interface CatalogResponse {
  engines: { key: string; name: string; modes: TakbotMode[]; bestFor: string; inline: boolean; connected: boolean }[];
  checkoutEnabled: boolean;
  session: { signedIn: boolean; workspace: boolean; balance: number | null };
}

interface Turn {
  id: string;
  prompt: string;
  mode: TakbotMode;
  state: "pending" | "done" | "error";
  text?: string;
  engineName?: string;
  auto?: boolean;
  credits?: number;
  balance?: number;
  error?: string;
}

const newId = () => (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40).padEnd(16, "0");

/** The TAK bot page: mode tabs, engine picker with search, prompt bar, answers, status board, credits. */
export function TakbotStudio() {
  const { lang } = useLanguage();
  const { theme, toggle } = useHomeTheme();
  const c = takbotCopy;
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [mode, setMode] = useState<TakbotMode>("chat");
  const [engine, setEngine] = useState("auto");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("mode");
    if (m && TAKBOT_MODES.some((x) => x.key === m)) setMode(m as TakbotMode);
    fetch("/api/takbot/catalog", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CatalogResponse | null) => data && setCatalog(data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const close = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPickerOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [pickerOpen]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns]);

  const modeDef = TAKBOT_MODES.find((m) => m.key === mode)!;
  const connected = useMemo(() => new Set(catalog?.engines.filter((e) => e.connected).map((e) => e.key) ?? []), [catalog]);
  const engines = TAKBOT_ENGINES.filter((e) => e.modes.includes(mode));
  const filtered = engines.filter((e) => `${e.name} ${e.bestFor}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = engine === "auto" ? null : TAKBOT_ENGINES.find((e) => e.key === engine) ?? null;
  const session = catalog?.session;
  const balance = turns.findLast((t) => typeof t.balance === "number")?.balance ?? session?.balance ?? null;
  const busy = turns.some((t) => t.state === "pending");

  const pickMode = (m: TakbotMode) => {
    setMode(m);
    if (selected && !selected.modes.includes(m)) setEngine("auto");
  };

  const run = async () => {
    const text = prompt.trim();
    if (!text || busy || !modeDef.inline) return;
    const id = newId();
    setTurns((t) => [...t, { id, prompt: text, mode, state: "pending" }]);
    setPrompt("");
    try {
      const res = await fetch("/api/takbot/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, engine, prompt: text, requestId: id }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      setTurns((all) =>
        all.map((t) =>
          t.id !== id
            ? t
            : data.ok
              ? { ...t, state: "done", text: String(data.text), engineName: String(data.engineName), auto: Boolean(data.auto), credits: Number(data.credits), balance: Number(data.balance) }
              : {
                  ...t,
                  state: "error",
                  error: (c.errors[data.code as keyof typeof c.errors] ?? c.errors.generic)[lang],
                  balance: typeof data.balance === "number" ? data.balance : undefined,
                },
        ),
      );
    } catch {
      setTurns((all) => all.map((t) => (t.id === id ? { ...t, state: "error", error: c.errors.generic[lang] } : t)));
    }
  };

  const ModeIcon = MODE_ICONS[mode];
  const thinkingName = selected?.name ?? "Auto";

  return (
    <div className="tk-page">
      {/* Hero + composer */}
      <section className="hp-bg relative overflow-hidden">
        <div aria-hidden className="hp-aurora absolute inset-0">
          <Aurora />
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === "light" ? (lang === "fr" ? "Passer au mode sombre" : "Switch to dark mode") : lang === "fr" ? "Passer au mode clair" : "Switch to light mode"}
          className="hp-ghost hp-focus absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full"
        >
          {theme === "light" ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
        </button>
        <div className="relative mx-auto max-w-3xl px-4 pb-20 pt-16 text-center sm:pt-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[var(--hp-alt)] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.26em] hp-ink-2 ring-1 ring-[var(--hp-line)]">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--hp-accent)] " />
              {c.hero.eyebrow[lang]}
            </p>
            <h1 className="hp-display hp-ink mt-6 text-balance text-[42px] sm:text-[72px]">{c.hero.title[lang]}</h1>
            <p className="mx-auto mt-6 max-w-xl text-[17px] leading-8 hp-ink-2">{c.hero.subtitle[lang]}</p>

            {/* Composer */}
            <div className="hp-raised mt-10 rounded-[28px] p-3 text-left ring-1 ring-[var(--hp-line)]">
              <div role="tablist" aria-label="TAK bot" className="tk-no-scrollbar flex gap-1 overflow-x-auto pb-2">
                {TAKBOT_MODES.map((m) => {
                  const Icon = MODE_ICONS[m.key];
                  const on = m.key === mode;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => pickMode(m.key)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors ${
                        on ? "hp-btn" : "hp-ink-2 hover:bg-[var(--hp-alt)]"
                      }`}
                    >
                      <Icon size={15} aria-hidden /> {takbotModeCopy[m.key].name[lang]}
                    </button>
                  );
                })}
              </div>

              <div className="hp-bg rounded-2xl border border-[var(--hp-line)]">
                <label htmlFor="takbot-prompt" className="sr-only">
                  {takbotModeCopy[mode].placeholder[lang]}
                </label>
                <textarea
                  id="takbot-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_CHARS))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void run();
                    }
                  }}
                  rows={3}
                  placeholder={takbotModeCopy[mode].placeholder[lang]}
                  className="w-full resize-none bg-transparent px-4 pt-4 text-[15px] leading-6 hp-ink placeholder:text-[var(--hp-ink-3)] focus:outline-none"
                />
                <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
                  {/* Engine picker */}
                  <div ref={pickerRef} className="relative">
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={pickerOpen}
                      onClick={() => setPickerOpen((o) => !o)}
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--hp-line)] bg-[var(--hp-alt)] px-3 py-2 text-[13px] font-semibold hp-ink hover:border-[var(--hp-ink-3)]"
                    >
                      <Bot size={15} className="hp-accent" aria-hidden />
                      <span className="hp-ink-2">{c.composer.engine[lang]}:</span> {selected?.name ?? "Auto"}
                      <ChevronDown size={14} className={`transition-transform ${pickerOpen ? "rotate-180" : ""}`} aria-hidden />
                    </button>
                    {pickerOpen && (
                      <div className="hp-raised animate-scale-in absolute bottom-full left-0 z-30 mb-2 w-[300px] rounded-2xl border border-[var(--hp-line)] p-2">
                        <div className="flex items-center gap-2 rounded-xl bg-[var(--hp-alt)] px-3 py-2">
                          <Search size={14} className="hp-ink-3" aria-hidden />
                          <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={c.composer.search[lang]}
                            aria-label={c.composer.search[lang]}
                            className="w-full bg-transparent text-[13px] hp-ink placeholder:text-[var(--hp-ink-3)] focus:outline-none"
                          />
                        </div>
                        <ul role="listbox" aria-label={c.composer.engine[lang]} className="mt-2 max-h-72 overflow-y-auto">
                          {[{ key: "auto", name: c.composer.auto[lang], bestFor: "", relay: "auto" } as const, ...filtered].map((e) => {
                            const on = engine === e.key;
                            const live = e.key === "auto" || connected.has(e.key);
                            const usable = e.key === "auto" || e.relay !== "studio";
                            return (
                              <li key={e.key} role="option" aria-selected={on}>
                                <button
                                  type="button"
                                  disabled={!usable}
                                  onClick={() => {
                                    setEngine(e.key);
                                    setPickerOpen(false);
                                  }}
                                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left disabled:opacity-45 ${on ? "hp-tint" : "hover:bg-[var(--hp-alt)]"}`}
                                >
                                  <span className={`h-2 w-2 shrink-0 rounded-full ${live ? "bg-emerald-500" : "bg-[var(--hp-line)]"}`} aria-hidden />
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-[13px] font-semibold hp-ink">{e.name}</span>
                                    {e.bestFor && <span className="block truncate text-[11.5px] hp-ink-3">{e.bestFor}</span>}
                                  </span>
                                  {on && <Check size={14} className="hp-accent" aria-hidden />}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--hp-alt)] px-3 py-2 text-[12.5px] hp-ink-2">
                    <Coins size={14} className="hp-warn" aria-hidden /> {creditsFor(modeDef) === 1 ? c.composer.costOne[lang] : fill(c.composer.cost[lang], { n: creditsFor(modeDef) })}
                  </span>
                  {typeof balance === "number" && (
                    <span className="text-[12.5px] hp-ink-2">{fill(c.composer.balance[lang], { n: balance.toLocaleString() })}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => void run()}
                    disabled={!prompt.trim() || busy || !modeDef.inline || !session?.workspace}
                    className="hp-cta ml-auto inline-flex items-center gap-2 rounded-full px-5 py-2 text-[13.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Send size={15} aria-hidden />} {c.composer.send[lang]}
                  </button>
                </div>
              </div>

              {/* Gate messages: sign-in, workspace, studio-only modes */}
              {!modeDef.inline ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl hp-tint hp-ink px-4 py-3 text-[13px]">
                  <span className="flex items-center gap-2">
                    <ModeIcon size={15} aria-hidden /> {fill(c.composer.studio[lang], { mode: takbotModeCopy[mode].name[lang] })}
                  </span>
                  <Link to={session?.signedIn ? "/dashboard/ai-studio" : "/register"} className="font-semibold hp-ink underline-offset-4 hover:underline">
                    {session?.signedIn ? c.composer.openStudio[lang] : c.composer.signInCta[lang]} →
                  </Link>
                </div>
              ) : catalog && !session?.signedIn ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl hp-tint hp-ink px-4 py-3 text-[13px]">
                  <span>{c.composer.signIn[lang]}</span>
                  <span className="flex gap-2">
                    <Link to="/login?next=/takbot" className="rounded-full px-4 py-1.5 font-semibold hp-ink ring-1 ring-[var(--hp-line)] hover:bg-[var(--hp-alt)]">
                      {c.composer.login[lang]}
                    </Link>
                    <Link to="/register" className="hp-cta rounded-full px-4 py-1.5 font-semibold">
                      {c.composer.signInCta[lang]}
                    </Link>
                  </span>
                </div>
              ) : catalog && session?.signedIn && !session.workspace ? (
                <p className="mt-3 rounded-xl hp-warn border border-current/30 bg-[var(--hp-alt)] px-4 py-3 text-[13px]">{c.composer.workspace[lang]}</p>
              ) : null}
            </div>

            {/* Conversation */}
            {turns.length > 0 && (
              <ol className="mt-8 grid gap-4 text-left" aria-live="polite">
                {turns.map((t) => (
                  <li key={t.id} className="grid gap-2">
                    <p className="ml-auto flex max-w-[85%] items-start gap-2 rounded-2xl rounded-tr-sm bg-[var(--hp-cta)] px-4 py-3 text-[14.5px] text-white">
                      <User size={15} className="mt-0.5 shrink-0 text-white/80" aria-hidden /> {t.prompt}
                    </p>
                    <div className="tk-slide-in max-w-[92%] rounded-2xl rounded-tl-sm border border-[var(--hp-line)] bg-[var(--hp-alt)] px-4 py-3 text-[14.5px] leading-7 hp-ink-2">
                      {t.state === "pending" && (
                        <span className="tk-caret inline-flex items-center gap-2 hp-ink-2">
                          <Loader2 size={15} className="animate-spin hp-accent" aria-hidden /> {fill(c.composer.thinking[lang], { engine: thinkingName })}
                        </span>
                      )}
                      {t.state === "done" && (
                        <>
                          <p className="whitespace-pre-wrap">{t.text}</p>
                          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--hp-line)] pt-2 text-[11.5px] hp-ink-3">
                            <span className="inline-flex items-center gap-1">
                              <Sparkles size={12} className="hp-accent" aria-hidden />
                              {fill(c.composer.answeredBy[lang], { engine: t.engineName ?? "" })}
                              {t.auto ? c.composer.viaAuto[lang] : ""}
                            </span>
                            <span>{fill(c.composer.spent[lang], { n: t.credits ?? 0, b: t.balance ?? 0 })}</span>
                          </p>
                        </>
                      )}
                      {t.state === "error" && <p className="hp-warn">{t.error}</p>}
                    </div>
                  </li>
                ))}
                <div ref={endRef} />
              </ol>
            )}
          </div>

        </div>
      </section>

      {/* How it works */}
      <section className="hp-bg py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <Kicker>TAK bot</Kicker>
          <h2 className="mt-3 hp-display hp-ink text-3xl sm:text-[42px]">{c.how.title[lang]}</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-4">
            {c.how.steps.map((s, i) => (
              <li key={s.t.en} className="relative border-t border-[var(--hp-line)] pt-6">
                <span className="hp-display hp-ink-3 text-4xl">0{i + 1}</span>
                <p className="mt-3 text-[16px] font-bold hp-ink">{s.t[lang]}</p>
                <p className="mt-2 text-[14px] leading-6 hp-ink-2">{s.d[lang]}</p>
                {i === 3 && <ShieldCheck size={18} className="absolute right-5 top-5 hp-ok" aria-hidden />}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Engine status board */}
      <section className="hp-alt py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="hp-display hp-ink text-3xl sm:text-[42px]">{c.engines.title[lang]}</h2>
          <p className="mt-3 max-w-2xl text-base hp-ink-2">{c.engines.subtitle[lang]}</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TAKBOT_ENGINES.map((e) => {
              const live = connected.has(e.key);
              return (
                <li key={e.key} className="hp-raised rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold hp-ink">{e.name}</p>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
                        !catalog ? "border-[var(--hp-line)] hp-ink-3" : live ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-[var(--hp-line)] hp-ink-2"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-[var(--hp-line)]"}`} />
                      {!catalog ? "…" : live ? c.composer.connected[lang] : c.composer.notConnected[lang]}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-5 hp-ink-2">{e.bestFor}</p>
                  <p className="mt-3 flex flex-wrap gap-1">
                    {e.modes.map((m) => (
                      <span key={m} className="rounded-full bg-[var(--hp-alt)] px-2 py-0.5 text-[10.5px] hp-ink-2">
                        {takbotModeCopy[m].name[lang]}
                      </span>
                    ))}
                    <span className="hp-tint hp-accent rounded-full px-2 py-0.5 text-[10.5px]">
                      {e.relay === "studio" ? c.engines.studio[lang] : c.engines.inline[lang]}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Credits */}
      <section id="credits" className="hp-bg py-16 sm:py-20" style={{ scrollMarginTop: "var(--tk-header-h, 64px)" }}>
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
            <div>
              <h2 className="hp-display hp-ink text-3xl sm:text-[42px]">{c.credits.title[lang]}</h2>
              <p className="mt-3 max-w-2xl text-base hp-ink-2">{c.credits.subtitle[lang]}</p>
              <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                {TAKBOT_PACKS.map((p) => {
                  const featured = p.key === "growth";
                  return (
                    <li
                      key={p.key}
                      className={`flex flex-col rounded-[22px] border p-5 ${
                        featured ? "hp-raised ring-2 ring-[var(--hp-cta)] border-transparent" : "hp-raised border-transparent"
                      }`}
                    >
                      <p className="font-bold hp-ink">{p.label}</p>
                      <p className="mt-2 text-3xl font-extrabold hp-ink">{money(lang, p.priceCad)}</p>
                      <p className="mt-1 text-sm hp-accent">{p.credits.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA")} {lang === "fr" ? "crédits" : "credits"}</p>
                      <div className="mt-5">
                        {catalog?.checkoutEnabled && session?.workspace ? (
                          <Link to="/dashboard/growth/ai-engine" className="hp-cta inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold">
                            {fill(c.credits.buy[lang], { name: p.label })} <ArrowRight size={15} aria-hidden />
                          </Link>
                        ) : (
                          <Link
                            to={session?.signedIn ? "/dashboard/growth/ai-engine" : "/register"}
                            className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold ${featured ? "hp-cta" : "hp-ghost"}`}
                          >
                            {session?.signedIn ? fill(c.credits.buy[lang], { name: p.label }) : c.composer.signInCta[lang]} <ArrowRight size={15} aria-hidden />
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {catalog && !catalog.checkoutEnabled && (
                <p className="mt-5 flex flex-wrap items-center gap-3 text-sm hp-ink-2">
                  {c.credits.soon[lang]}
                  <button
                    type="button"
                    onClick={() => openLiveChat({ page: "/takbot", intent: "takbot_credits", lang })}
                    className="inline-flex items-center gap-1.5 font-semibold hp-accent hover:underline"
                  >
                    <Headset size={14} aria-hidden /> {c.credits.ask[lang]}
                  </button>
                </p>
              )}
            </div>
            <aside className="hp-card rounded-[24px] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] hp-ink-3">{c.credits.costs[lang]}</p>
              <ul className="mt-4 grid gap-2">
                {TAKBOT_ACTIONS.map((a) => (
                  <li key={a.key} className="flex items-baseline justify-between gap-3 border-b border-[var(--hp-line)] pb-2 text-[13px]">
                    <span className="hp-ink-2">{a.label}</span>
                    <span className="shrink-0 font-bold tabular-nums hp-ink">{a.credits}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
