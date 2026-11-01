"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, Check, Loader2, Lock } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { TAKBOT_MODES, MAX_PROMPT_CHARS, creditsFor } from "@/lib/takbot/catalog";
import { takbotModeCopy } from "@/lib/takbot/copy";
import { trialCopy as c } from "@/lib/takbot/trial-copy";
import { Link } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";
import { sectionId } from "./HomeSectionNav";
import { RobotMascot } from "./RobotMascot";

export type TryMode = "chat" | "write" | "research";
const TRY_MODES: TryMode[] = ["chat", "write", "research"];
const PENDING_KEY = "takbot:pending";
const RETURN_PATH = "/?essai=takbot";

/** Ask TAK-TAK from anywhere on the page (the concierge uses it). */
export const TAKBOT_PREFILL_EVENT = "takbot:prefill";
export function prefillTakbot(prompt: string, mode: TryMode = "chat") {
  window.dispatchEvent(new CustomEvent(TAKBOT_PREFILL_EVENT, { detail: { prompt, mode } }));
}
/** Switch the live bot's mode without touching the prompt or scrolling (the studio's side menu). */
export function setTakbotMode(mode: TryMode) {
  window.dispatchEvent(new CustomEvent(TAKBOT_PREFILL_EVENT, { detail: { mode, stay: true } }));
}

interface Trial {
  enabled: boolean;
  credits: number;
  engineName: string | null;
  claimed: boolean;
  premium: boolean;
}
interface Session {
  signedIn: boolean;
  workspace: boolean;
  balance: number | null;
  firstName: string | null;
}
interface Turn {
  id: string;
  prompt: string;
  mode: TryMode;
  state: "pending" | "done" | "error";
  text?: string;
  engineName?: string;
  saved?: boolean;
  error?: string;
}

const newId = () => (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40).padEnd(16, "0");

function readPending(): { prompt: string; mode: TryMode } | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { prompt?: unknown; mode?: unknown };
    if (typeof v.prompt !== "string") return null;
    return { prompt: v.prompt.slice(0, MAX_PROMPT_CHARS), mode: TRY_MODES.includes(v.mode as TryMode) ? (v.mode as TryMode) : "chat" };
  } catch {
    return null;
  }
}
function writePending(value: { prompt: string; mode: TryMode } | null) {
  try {
    if (value) sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* private window: the prompt is simply not restored */
  }
}

/** Light clean-up of model markdown, shown as plain text (never as HTML). */
const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/`{1,3}/g, "");

/** The answer appears letter by letter, like the page typing it. */
function Typed({ text }: { text: string }) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let i = 0;
    const step = Math.max(2, Math.ceil(text.length / 180));
    const timer = window.setInterval(() => {
      i = Math.min(text.length, i + step);
      setN(i);
      if (i >= text.length) window.clearInterval(timer);
    }, 16);
    return () => window.clearInterval(timer);
  }, [text, reduced]);
  const shown = reduced ? text.length : n;
  const paras = text.slice(0, shown).split(/\n{2,}/);
  return (
    <>
      <span aria-hidden className="block space-y-2.5">
        {paras.map((p, i) => (
          <span key={i} className="block whitespace-pre-wrap">
            {p}
            {i === paras.length - 1 && shown < text.length && (
              <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-[#29C3FF]" />
            )}
          </span>
        ))}
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * The real TAK-TAK on the homepage. Signed out: sign in with Google (or
 * email) first, which creates the visitor's TAKATAK account and client file.
 * Signed in: the trial credits are claimed once, then every answer runs on
 * the server (credits debited, refunded on failure) and is kept in the file.
 */
export function TakbotTryPanel({ onShowApp, bare = false }: { onShowApp: () => void; /** Inside the studio frame: no frame of its own. */ bare?: boolean }) {
  const { lang } = useLanguage();
  const [trial, setTrial] = useState<Trial | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [claim, setClaim] = useState<"idle" | "working" | "done" | "error">("idle");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [welcome, setWelcome] = useState<string | null>(null);
  const [mode, setMode] = useState<TryMode>("write");
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [out, setOut] = useState(false);
  const [googleOff, setGoogleOff] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);

  // Catalog (trial offer + session), and the prompt kept across the sign-in round trip.
  useEffect(() => {
    let alive = true;
    fetch("/api/takbot/catalog", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { trial?: Trial; session?: Session } | null) => {
        if (!alive || !data) return;
        setTrial(data.trial ?? null);
        setSession(data.session ?? null);
        setBalance(data.session?.balance ?? null);
      })
      .catch(() => undefined);
    const pending = readPending();
    if (pending) {
      setPrompt(pending.prompt);
      setMode(pending.mode);
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("essai") === "takbot") {
      params.delete("essai");
      const q = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`);
      window.setTimeout(() => document.getElementById(sectionId("takbot"))?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    }
    return () => {
      alive = false;
    };
  }, []);

  // Requests from the concierge or anywhere else on the page.
  useEffect(() => {
    const onPrefill = (e: Event) => {
      const d = (e as CustomEvent<{ prompt?: string; mode?: TryMode; stay?: boolean }>).detail;
      if (typeof d?.prompt === "string") setPrompt(d.prompt.slice(0, MAX_PROMPT_CHARS));
      if (d?.mode && TRY_MODES.includes(d.mode)) setMode(d.mode);
      if (d?.stay) return;
      document.getElementById(sectionId("takbot"))?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => input.current?.focus({ preventScroll: true }), 600);
    };
    window.addEventListener(TAKBOT_PREFILL_EVENT, onPrefill);
    return () => window.removeEventListener(TAKBOT_PREFILL_EVENT, onPrefill);
  }, []);

  // Signed in to a workspace that never had its trial: claim it once.
  useEffect(() => {
    if (!trial?.enabled || !session?.workspace || trial.claimed || trial.premium || claim !== "idle") return;
    setClaim("working");
    fetch("/api/takbot/trial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang, sourcePage: "/" }),
    })
      .then(async (r) => {
        const data = (await r.json().catch(() => ({}))) as { ok?: boolean; balance?: number; granted?: boolean; code?: string };
        if (data.ok) {
          setBalance(typeof data.balance === "number" ? data.balance : null);
          setTrial((t) => (t ? { ...t, claimed: true } : t));
          if (data.granted) setWelcome(c.welcome(session.firstName, trial.credits)[lang]);
          setClaim("done");
        } else {
          setClaimError((c.errors[data.code ?? ""] ?? c.errors.generic)[lang]);
          setClaim("error");
        }
      })
      .catch(() => {
        setClaimError(c.errors.generic[lang]);
        setClaim("error");
      });
  }, [trial, session, claim, lang]);

  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const signInGoogle = useCallback(async () => {
    writePending(prompt.trim() ? { prompt: prompt.trim(), mode } : null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setGoogleOff(true);
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(RETURN_PATH)}` },
    });
    if (error) setGoogleOff(true);
  }, [prompt, mode]);

  const keepPrompt = () => writePending(prompt.trim() ? { prompt: prompt.trim(), mode } : null);

  const busy = turns.some((t) => t.state === "pending");
  const cost = creditsFor(TAKBOT_MODES.find((m) => m.key === mode)!);
  const ready = Boolean(session?.workspace && trial && (trial.premium || trial.claimed || !trial.enabled));
  const canRun = ready && !busy && !out && prompt.trim().length > 0 && (balance === null || balance >= cost);

  const run = async () => {
    const text = prompt.trim();
    if (!canRun || !text) return;
    const id = newId();
    setTurns((t) => [...t, { id, prompt: text, mode, state: "pending" }]);
    setPrompt("");
    writePending(null);
    try {
      const res = await fetch("/api/takbot/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, engine: "auto", prompt: text, requestId: id }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (typeof data.balance === "number") setBalance(data.balance);
      if (data.code === "insufficient_credits") setOut(true);
      if (data.code === "sign_in_required" || data.code === "workspace_required") setSession((v) => (v ? { ...v, workspace: false, signedIn: data.code === "workspace_required" } : v));
      setTurns((all) =>
        all.map((t) =>
          t.id !== id
            ? t
            : data.ok
              ? { ...t, state: "done", text: plain(String(data.text)), engineName: String(data.engineName), saved: Boolean(data.savedId) }
              : { ...t, state: "error", error: (c.errors[String(data.code)] ?? c.errors.generic)[lang] },
        ),
      );
    } catch {
      setTurns((all) => all.map((t) => (t.id === id ? { ...t, state: "error", error: c.errors.generic[lang] } : t)));
    }
  };

  const locale = lang === "fr" ? "fr-CA" : "en-CA";
  const signedOut = session !== null && !session.signedIn;
  const noWorkspace = session?.signedIn && !session.workspace;
  const trialOpen = Boolean(trial?.enabled);
  const engineShort = trial?.engineName?.replace(/\s*\(.*\)\s*$/, "") ?? null;
  const label = trial?.premium ? c.premium[lang] : c.economy(engineShort)[lang];

  return (
    <div ref={panel} className={bare ? "overflow-hidden bg-[#0B1220]" : "hp-pop3d overflow-hidden rounded-[22px] bg-[#0B1220] shadow-[0_50px_120px_-40px_rgb(0_0_0/0.9)] ring-1 ring-white/10"}>
      {/* Status bar */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[#1E6BFF]/20">
          <RobotMascot size={34} wave={false} headOnly title="TAK-TAK" />
          {trialOpen && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0B1220]" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-white">{c.title[lang]}</p>
          <p className="truncate font-mono text-[11.5px] text-white/45">{ready || session?.workspace ? `// ${label}` : `// takatak.ca/takbot`}</p>
        </div>
        {session?.workspace && balance !== null ? (
          <span className="rounded-full bg-white/[0.07] px-3 py-1 text-[13px] font-semibold tabular-nums text-white" aria-live="polite">
            {balance.toLocaleString(locale)} {lang === "fr" && balance <= 1 ? "crédit" : balance === 1 ? "credit" : c.balance[lang]}
          </span>
        ) : trialOpen ? (
          <span className="rounded-full bg-[#29C3FF]/15 px-3 py-1 text-[12.5px] font-semibold text-[#7FD8FF]">{c.free(trial!.credits)[lang]}</span>
        ) : null}
      </div>

      {/* Conversation */}
      <div ref={log} className="max-h-[340px] min-h-[220px] space-y-4 overflow-y-auto px-4 py-5 sm:px-5" aria-live="polite">
        {welcome && <p className="tk-fade-in rounded-2xl bg-emerald-400/10 px-4 py-3 text-[14px] text-emerald-200">{welcome}</p>}
        {claim === "working" && (
          <p className="flex items-center gap-2 text-[14px] text-white/60">
            <Loader2 size={15} className="animate-spin" aria-hidden /> {c.claiming[lang]}
          </p>
        )}
        {claimError && <p className="rounded-2xl bg-amber-400/10 px-4 py-3 text-[14px] text-amber-200">{claimError}</p>}

        {turns.length === 0 && (
          <div>
            {session?.workspace && !welcome && <p className="text-[15px] text-white/80">{c.hello(session.firstName)[lang]}</p>}
            {(signedOut || session === null) && trialOpen && (
              <ol className="space-y-2.5">
                {c.steps.map((s, i) => (
                  <li key={s.fr} className="flex items-center gap-3 text-[14.5px] text-white/80">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[12px] font-semibold tabular-nums text-white">{i + 1}</span>
                    {i === 2 ? `${s[lang]} · ${c.free(trial!.credits)[lang]}` : s[lang]}
                  </li>
                ))}
              </ol>
            )}
            {!trialOpen && trial !== null && !trial.premium && <p className="text-[14.5px] leading-7 text-white/70">{c.soon[lang]}</p>}
            {noWorkspace && (
              <p className="text-[14.5px] text-white/70">
                {c.workspace[lang]}{" "}
                <Link to="/dashboard" className="font-semibold text-[#7FD8FF] underline-offset-4 hover:underline">
                  {c.dashboard[lang]}
                </Link>
              </p>
            )}
            <p className="mt-5 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-white/35">{c.samplesLabel[lang]}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {c.samples.map((s) => (
                <button
                  key={s.fr}
                  type="button"
                  onClick={() => {
                    setMode(s.mode);
                    setPrompt(s[lang]);
                    input.current?.focus();
                  }}
                  className="rounded-full bg-white/[0.06] px-3 py-1.5 text-left text-[13px] text-white/75 ring-1 ring-white/10 transition-colors hover:bg-white/[0.12] hover:text-white"
                >
                  {s[lang]}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t) => (
          <div key={t.id} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[#1E6BFF] px-4 py-2.5 text-[14.5px] text-white">{t.prompt}</p>
            {t.state === "pending" && (
              <p className="flex items-center gap-2 text-[14px] text-white/55">
                <Loader2 size={15} className="animate-spin" aria-hidden /> {c.thinking[lang]}
              </p>
            )}
            {t.state === "done" && t.text && (
              <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-white/[0.06] px-4 py-3 ring-1 ring-white/10">
                <div className="text-[14.5px] leading-7 text-white/90">
                  <Typed text={t.text} />
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/45">
                  <span>{t.engineName?.replace(/\s*\(.*\)\s*$/, "")}</span>
                  {t.saved && (
                    <Link to="/dashboard/ai-studio/saved" className="inline-flex items-center gap-1 text-emerald-300/90 hover:text-emerald-200">
                      <Check size={12} aria-hidden /> {c.saved[lang]} · {c.seeSaved[lang]}
                    </Link>
                  )}
                </p>
              </div>
            )}
            {t.state === "error" && <p className="rounded-2xl bg-amber-400/10 px-4 py-2.5 text-[14px] text-amber-200">{t.error}</p>}
          </div>
        ))}

        {(out || (ready && trial?.claimed && !trial.premium && balance !== null && balance < 1)) && (
          <div className="rounded-2xl bg-[#1E6BFF]/15 px-4 py-3 ring-1 ring-[#29C3FF]/30">
            <p className="text-[14px] leading-6 text-white/85">{c.out[lang]}</p>
            <Link to="/takbot#credits" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#060D1F]">
              {c.buy[lang]} <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        )}
      </div>

      {/* Composer, or the sign-in gate */}
      <div className="border-t border-white/10 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Mode">
          {TRY_MODES.map((m) => {
            const def = TAKBOT_MODES.find((x) => x.key === m)!;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${mode === m ? "bg-white text-[#060D1F]" : "bg-white/[0.06] text-white/70 hover:text-white"}`}
              >
                {takbotModeCopy[m].name[lang]} <span className="font-normal opacity-60">· {c.costs(creditsFor(def))[lang]}</span>
              </button>
            );
          })}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
          className="flex items-end gap-2 rounded-2xl bg-white/[0.05] p-2 ring-1 ring-white/10 focus-within:ring-[#29C3FF]/60"
        >
          <label htmlFor="home-takbot-prompt" className="sr-only">
            {c.placeholder[mode][lang]}
          </label>
          <textarea
            id="home-takbot-prompt"
            ref={input}
            rows={2}
            maxLength={MAX_PROMPT_CHARS}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void run();
              }
            }}
            placeholder={c.placeholder[mode][lang]}
            className="min-h-[48px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] text-white placeholder:text-white/35 focus:outline-none"
          />
          {ready ? (
            <button
              type="submit"
              disabled={!canRun}
              aria-label={c.send[lang]}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#060D1F] transition-transform enabled:hover:scale-105 disabled:opacity-35"
            >
              {busy ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <ArrowUp size={18} aria-hidden />}
            </button>
          ) : (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white/50" aria-hidden>
              <Lock size={16} />
            </span>
          )}
        </form>

        {(signedOut || session === null) && trialOpen && (
          <div className="mt-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => void signInGoogle()}
                className="inline-flex items-center justify-center gap-2.5 rounded-full bg-white px-5 py-3 text-[14.5px] font-semibold text-[#1F1F1F] transition-transform hover:scale-[1.02]"
              >
                <GoogleMark /> {c.google[lang]}
              </button>
              <Link
                to="/login"
                search={{ next: RETURN_PATH }}
                onClick={keepPrompt}
                className="inline-flex items-center justify-center rounded-full px-4 py-3 text-[14px] font-semibold text-white/75 ring-1 ring-white/15 hover:text-white"
              >
                {c.email[lang]}
              </Link>
            </div>
            {googleOff && <p className="mt-2 text-[13px] text-amber-200">{c.google_off[lang]}</p>}
            <p className="mt-3 text-[12px] leading-5 text-white/40">
              {c.consent[lang]}{" "}
              <Link to="/terms" className="underline underline-offset-2 hover:text-white/70">
                {c.terms[lang]}
              </Link>{" "}
              ·{" "}
              <Link to="/privacy" className="underline underline-offset-2 hover:text-white/70">
                {c.privacy[lang]}
              </Link>
            </p>
          </div>
        )}
        {!trialOpen && trial !== null && !trial.premium && !session?.workspace && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onShowApp} className="rounded-full bg-white px-4 py-2 text-[13.5px] font-semibold text-[#060D1F]">
              {c.tabs.app[lang]}
            </button>
            <Link to="/takbot" className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-semibold text-white/75 ring-1 ring-white/15 hover:text-white">
              {c.openTakbot[lang]} <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
