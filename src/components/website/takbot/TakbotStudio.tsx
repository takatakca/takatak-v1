"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Bot, Check, ChevronDown, Coins, Headset, Loader2, Search, Send, ShieldCheck, Sparkles, User } from "lucide-react";

import { MODE_ICONS } from "@/components/website/funnel/TakbotSection";
import { TakbotOrbit } from "@/components/website/funnel/TakbotOrbit";
import { Kicker, money } from "@/components/website/premium/ui";
import { TAKBOT_ACTIONS, TAKBOT_ENGINES, TAKBOT_MODES, TAKBOT_PACKS, MAX_PROMPT_CHARS, creditsFor, type TakbotMode } from "@/lib/takbot/catalog";
import { takbotCopy, takbotModeCopy } from "@/lib/takbot/copy";
import { openLiveChat } from "@/lib/website/chat-provider";
import { fill } from "@/lib/website/home-funnel";
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
    <div className="tk-page tk-premium brand-dark">
      {/* Hero + composer */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="tk-grid-lines pointer-events-none absolute inset-0 opacity-60" />
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(31_139_255/0.28),transparent)] blur-2xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-12 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div>
            <p className="tk-glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/80">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#29C3FF] shadow-[0_0_12px_#29C3FF]" />
              {c.hero.eyebrow[lang]}
            </p>
            <h1 className="tk-gradient-text mt-5 text-balance text-[40px] font-extrabold leading-[1.03] tracking-[-0.035em] sm:text-6xl">{c.hero.title[lang]}</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/72 sm:text-[17px]">{c.hero.subtitle[lang]}</p>

            {/* Composer */}
            <div className="tk-glass mt-8 rounded-[24px] p-3 shadow-[0_30px_80px_-40px_#1F8BFF]">
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
                        on ? "bg-[#1F8BFF] text-white" : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      <Icon size={15} aria-hidden /> {takbotModeCopy[m.key].name[lang]}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#060D1F]/80">
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
                  className="w-full resize-none bg-transparent px-4 pt-4 text-[15px] leading-6 text-white placeholder:text-white/35 focus:outline-none"
                />
                <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
                  {/* Engine picker */}
                  <div ref={pickerRef} className="relative">
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={pickerOpen}
                      onClick={() => setPickerOpen((o) => !o)}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-[13px] font-semibold text-white hover:border-white/25"
                    >
                      <Bot size={15} className="text-[#29C3FF]" aria-hidden />
                      <span className="text-white/55">{c.composer.engine[lang]}:</span> {selected?.name ?? "Auto"}
                      <ChevronDown size={14} className={`transition-transform ${pickerOpen ? "rotate-180" : ""}`} aria-hidden />
                    </button>
                    {pickerOpen && (
                      <div className="animate-scale-in absolute bottom-full left-0 z-30 mb-2 w-[300px] rounded-2xl border border-white/12 bg-[#0B1B3D] p-2 shadow-2xl">
                        <div className="flex items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2">
                          <Search size={14} className="text-white/45" aria-hidden />
                          <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={c.composer.search[lang]}
                            aria-label={c.composer.search[lang]}
                            className="w-full bg-transparent text-[13px] text-white placeholder:text-white/40 focus:outline-none"
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
                                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left disabled:opacity-45 ${on ? "bg-[#1F8BFF]/20" : "hover:bg-white/[0.05]"}`}
                                >
                                  <span className={`h-2 w-2 shrink-0 rounded-full ${live ? "bg-emerald-300" : "bg-white/25"}`} aria-hidden />
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-[13px] font-semibold text-white">{e.name}</span>
                                    {e.bestFor && <span className="block truncate text-[11.5px] text-white/50">{e.bestFor}</span>}
                                  </span>
                                  {on && <Check size={14} className="text-[#29C3FF]" aria-hidden />}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.04] px-3 py-2 text-[12.5px] text-white/65">
                    <Coins size={14} className="text-amber-200" aria-hidden /> {creditsFor(modeDef) === 1 ? c.composer.costOne[lang] : fill(c.composer.cost[lang], { n: creditsFor(modeDef) })}
                  </span>
                  {typeof balance === "number" && (
                    <span className="text-[12.5px] text-white/55">{fill(c.composer.balance[lang], { n: balance.toLocaleString() })}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => void run()}
                    disabled={!prompt.trim() || busy || !modeDef.inline || !session?.workspace}
                    className="tk-btn-primary ml-auto inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Send size={15} aria-hidden />} {c.composer.send[lang]}
                  </button>
                </div>
              </div>

              {/* Gate messages: sign-in, workspace, studio-only modes */}
              {!modeDef.inline ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-300/20 bg-sky-300/[0.06] px-4 py-3 text-[13px] text-sky-100">
                  <span className="flex items-center gap-2">
                    <ModeIcon size={15} aria-hidden /> {fill(c.composer.studio[lang], { mode: takbotModeCopy[mode].name[lang] })}
                  </span>
                  <Link to={session?.signedIn ? "/dashboard/ai-studio" : "/register"} className="font-semibold text-white underline-offset-4 hover:underline">
                    {session?.signedIn ? c.composer.openStudio[lang] : c.composer.signInCta[lang]} →
                  </Link>
                </div>
              ) : catalog && !session?.signedIn ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1F8BFF]/30 bg-[#1F8BFF]/[0.08] px-4 py-3 text-[13px] text-white/85">
                  <span>{c.composer.signIn[lang]}</span>
                  <span className="flex gap-2">
                    <Link to="/login?next=/takbot" className="tk-btn-ghost rounded-lg px-3 py-1.5 font-semibold">
                      {c.composer.login[lang]}
                    </Link>
                    <Link to="/register" className="tk-btn-primary rounded-lg px-3 py-1.5 font-semibold">
                      {c.composer.signInCta[lang]}
                    </Link>
                  </span>
                </div>
              ) : catalog && session?.signedIn && !session.workspace ? (
                <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] px-4 py-3 text-[13px] text-amber-100">{c.composer.workspace[lang]}</p>
              ) : null}
            </div>

            {/* Conversation */}
            {turns.length > 0 && (
              <ol className="mt-6 grid gap-4" aria-live="polite">
                {turns.map((t) => (
                  <li key={t.id} className="grid gap-2">
                    <p className="ml-auto flex max-w-[85%] items-start gap-2 rounded-2xl rounded-tr-sm bg-[#1F8BFF]/20 px-4 py-3 text-[14.5px] text-white">
                      <User size={15} className="mt-0.5 shrink-0 text-[#7CC4FF]" aria-hidden /> {t.prompt}
                    </p>
                    <div className="tk-slide-in max-w-[92%] rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.04] px-4 py-3 text-[14.5px] leading-7 text-white/85">
                      {t.state === "pending" && (
                        <span className="tk-caret inline-flex items-center gap-2 text-white/65">
                          <Loader2 size={15} className="animate-spin text-[#29C3FF]" aria-hidden /> {fill(c.composer.thinking[lang], { engine: thinkingName })}
                        </span>
                      )}
                      {t.state === "done" && (
                        <>
                          <p className="whitespace-pre-wrap">{t.text}</p>
                          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 pt-2 text-[11.5px] text-white/50">
                            <span className="inline-flex items-center gap-1">
                              <Sparkles size={12} className="text-[#29C3FF]" aria-hidden />
                              {fill(c.composer.answeredBy[lang], { engine: t.engineName ?? "" })}
                              {t.auto ? c.composer.viaAuto[lang] : ""}
                            </span>
                            <span>{fill(c.composer.spent[lang], { n: t.credits ?? 0, b: t.balance ?? 0 })}</span>
                          </p>
                        </>
                      )}
                      {t.state === "error" && <p className="text-amber-100">{t.error}</p>}
                    </div>
                  </li>
                ))}
                <div ref={endRef} />
              </ol>
            )}
          </div>

          <div className="hidden overflow-hidden lg:block">
            <TakbotOrbit size={480} connected={connected} />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-white/[0.06] py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <Kicker>TAK bot</Kicker>
          <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.025em] text-white sm:text-[40px]">{c.how.title[lang]}</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-4">
            {c.how.steps.map((s, i) => (
              <li key={s.t.en} className="tk-glass relative rounded-2xl p-5">
                <span className="tk-gradient-text text-4xl font-extrabold">0{i + 1}</span>
                <p className="mt-3 text-[16px] font-bold text-white">{s.t[lang]}</p>
                <p className="mt-2 text-[14px] leading-6 text-white/65">{s.d[lang]}</p>
                {i === 3 && <ShieldCheck size={18} className="absolute right-5 top-5 text-emerald-300" aria-hidden />}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Engine status board */}
      <section className="border-t border-white/[0.06] bg-[#040916] py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-3xl font-extrabold tracking-[-0.025em] text-white sm:text-[40px]">{c.engines.title[lang]}</h2>
          <p className="mt-3 max-w-2xl text-base text-white/65">{c.engines.subtitle[lang]}</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TAKBOT_ENGINES.map((e) => {
              const live = connected.has(e.key);
              return (
                <li key={e.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-white">{e.name}</p>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
                        !catalog ? "border-white/15 text-white/50" : live ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/15 text-white/55"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-300" : "bg-white/30"}`} />
                      {!catalog ? "…" : live ? c.composer.connected[lang] : c.composer.notConnected[lang]}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-5 text-white/55">{e.bestFor}</p>
                  <p className="mt-3 flex flex-wrap gap-1">
                    {e.modes.map((m) => (
                      <span key={m} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] text-white/65">
                        {takbotModeCopy[m].name[lang]}
                      </span>
                    ))}
                    <span className="rounded-full bg-[#1F8BFF]/15 px-2 py-0.5 text-[10.5px] text-[#9DD3FF]">
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
      <section id="credits" className="border-t border-white/[0.06] py-16 sm:py-20" style={{ scrollMarginTop: "var(--tk-header-h, 64px)" }}>
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
            <div>
              <h2 className="text-3xl font-extrabold tracking-[-0.025em] text-white sm:text-[40px]">{c.credits.title[lang]}</h2>
              <p className="mt-3 max-w-2xl text-base text-white/65">{c.credits.subtitle[lang]}</p>
              <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                {TAKBOT_PACKS.map((p) => {
                  const featured = p.key === "growth";
                  return (
                    <li
                      key={p.key}
                      className={`flex flex-col rounded-[22px] border p-5 ${
                        featured ? "border-[#1F8BFF]/70 bg-[linear-gradient(160deg,rgb(31_139_255/0.2),rgb(11_27_61/0.9)_60%)]" : "border-white/10 bg-white/[0.035]"
                      }`}
                    >
                      <p className="font-bold text-white">{p.label}</p>
                      <p className="mt-2 text-3xl font-extrabold text-white">{money(lang, p.priceCad)}</p>
                      <p className="mt-1 text-sm text-[#9DD3FF]">{p.credits.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA")} {lang === "fr" ? "crédits" : "credits"}</p>
                      <div className="mt-5">
                        {catalog?.checkoutEnabled && session?.workspace ? (
                          <Link to="/dashboard/growth/ai-engine" className="tk-btn-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold">
                            {fill(c.credits.buy[lang], { name: p.label })} <ArrowRight size={15} aria-hidden />
                          </Link>
                        ) : (
                          <Link
                            to={session?.signedIn ? "/dashboard/growth/ai-engine" : "/register"}
                            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${featured ? "tk-btn-primary" : "tk-btn-ghost"}`}
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
                <p className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/55">
                  {c.credits.soon[lang]}
                  <button
                    type="button"
                    onClick={() => openLiveChat({ page: "/takbot", intent: "takbot_credits", lang })}
                    className="inline-flex items-center gap-1.5 font-semibold text-[#7CC4FF] hover:text-white"
                  >
                    <Headset size={14} aria-hidden /> {c.credits.ask[lang]}
                  </button>
                </p>
              )}
            </div>
            <aside className="tk-glass rounded-2xl p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">{c.credits.costs[lang]}</p>
              <ul className="mt-4 grid gap-2">
                {TAKBOT_ACTIONS.map((a) => (
                  <li key={a.key} className="flex items-baseline justify-between gap-3 border-b border-white/[0.06] pb-2 text-[13px]">
                    <span className="text-white/75">{a.label}</span>
                    <span className="shrink-0 font-bold tabular-nums text-white">{a.credits}</span>
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
