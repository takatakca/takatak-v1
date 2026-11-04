"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Headset, Loader2, ShieldAlert } from "lucide-react";

/**
 * Admin › Users: an agent on a call checks that the person is really the
 * account holder. The person's signed-in devices show « Êtes-vous en contact
 * avec le soutien TAKATAK ? » with three numbers; the agent reads out the one
 * shown here and follows the answer live (docs/security/SECURITY_SCREENS.md).
 */

type Lang = "fr" | "en";
type State =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "waiting" | "confirmed" | "denied" | "mismatch" | "expired"; checkId: string; matchNumber: number }
  | { phase: "error"; message: string };

const T = {
  start: { fr: "Vérifier l’identité", en: "Verify identity" },
  read: { fr: "Lisez ce nombre au client :", en: "Read this number to the client:" },
  waiting: { fr: "En attente de sa réponse sur son appareil…", en: "Waiting for the answer on their device…" },
  confirmed: { fr: "Confirmé : c’est bien la personne du compte.", en: "Confirmed: this is the account holder." },
  denied: { fr: "Refusé : la personne dit ne pas parler au soutien. Ne donnez aucune information.", en: "Refused: the person says they are not talking to support. Share nothing." },
  mismatch: { fr: "Mauvais nombre : ne donnez aucune information.", en: "Wrong number: share nothing." },
  expired: { fr: "Pas de réponse (client pas connecté ?). Rien n’est confirmé.", en: "No answer (client not signed in?). Nothing is confirmed." },
  again: { fr: "Nouvelle vérification", en: "Check again" },
  tooMany: { fr: "Trop de vérifications ouvertes pour cette personne. Attendez 3 minutes.", en: "Too many open checks for this person. Wait 3 minutes." },
  failed: { fr: "La vérification n’a pas pu démarrer.", en: "The check could not start." },
} as const;

function readLang(): Lang {
  try {
    const stored = window.localStorage.getItem("takatak.lang");
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    /* ignore */
  }
  return document.documentElement.lang.startsWith("en") ? "en" : "fr";
}

export function SupportIdentityCheck({ profileId, disabled }: { profileId: string; disabled?: boolean }) {
  const [lang, setLang] = useState<Lang>("fr");
  const [state, setState] = useState<State>({ phase: "idle" });
  const timer = useRef<number | undefined>(undefined);
  const t = <K extends keyof typeof T>(key: K) => T[key][lang];

  useEffect(() => {
    setLang(readLang());
    return () => window.clearInterval(timer.current);
  }, []);

  const follow = (checkId: string, matchNumber: number) => {
    window.clearInterval(timer.current);
    timer.current = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/security/checks/${checkId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { status?: string };
        const status = data.status;
        if (status === "confirmed" || status === "denied" || status === "mismatch" || status === "expired") {
          window.clearInterval(timer.current);
          setState({ phase: status, checkId, matchNumber });
        }
      } catch {
        /* keep polling */
      }
    }, 3_000);
  };

  const start = async () => {
    setState({ phase: "starting" });
    try {
      const res = await fetch("/api/admin/security/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; checkId?: string; matchNumber?: number };
      if (data.ok && data.checkId && typeof data.matchNumber === "number") {
        setState({ phase: "waiting", checkId: data.checkId, matchNumber: data.matchNumber });
        follow(data.checkId, data.matchNumber);
      } else {
        setState({ phase: "error", message: data.code === "too_many" ? t("tooMany") : t("failed") });
      }
    } catch {
      setState({ phase: "error", message: t("failed") });
    }
  };

  if (state.phase === "idle" || state.phase === "starting" || state.phase === "error") {
    return (
      <div className="min-w-40">
        <button
          type="button"
          onClick={() => void start()}
          disabled={disabled || state.phase === "starting"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {state.phase === "starting" ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Headset size={13} aria-hidden />}
          {t("start")}
        </button>
        {state.phase === "error" && <p className="mt-1 text-[11px] text-red-700">{state.message}</p>}
      </div>
    );
  }

  const tone =
    state.phase === "confirmed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : state.phase === "waiting"
        ? "border-slate-200 bg-slate-50 text-slate-800"
        : "border-red-200 bg-red-50 text-red-900";
  return (
    <div className={`min-w-56 max-w-xs rounded-xl border p-2.5 text-xs ${tone}`} aria-live="polite">
      <p className="font-medium">{t("read")}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{state.matchNumber}</p>
      <p className="mt-1.5 flex items-start gap-1.5">
        {state.phase === "waiting" ? (
          <Clock size={13} className="mt-0.5 shrink-0" aria-hidden />
        ) : state.phase === "confirmed" ? (
          <CheckCircle2 size={13} className="mt-0.5 shrink-0" aria-hidden />
        ) : (
          <ShieldAlert size={13} className="mt-0.5 shrink-0" aria-hidden />
        )}
        <span>{t(state.phase)}</span>
      </p>
      {state.phase !== "waiting" && (
        <button type="button" onClick={() => void start()} className="mt-2 font-semibold underline">
          {t("again")}
        </button>
      )}
    </div>
  );
}
