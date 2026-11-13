"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Headset, MonitorSmartphone, ShieldAlert, ShieldCheck, X } from "lucide-react";

/**
 * The security screens (docs/security/SECURITY_SCREENS.md) on every signed-in
 * dashboard page:
 * - « Êtes-vous en contact avec le soutien TAKATAK ? » when an agent on a call
 *   starts an identity check: tap the number the agent reads out.
 * - « Nouvelle connexion à votre compte » when another device signs in: tap the
 *   number shown on that device, or « Ce n'était pas moi ».
 * - On the new device itself: the number to tap elsewhere, then « Connexion
 *   approuvée ».
 * Answers are checked by the server; this component only shows and sends.
 */

type Lang = "fr" | "en";
type Prompt = {
  id: string;
  kind: "support_identity" | "new_sign_in";
  choices: number[];
  deviceLabel: string | null;
  ipHint: string | null;
  createdAt: string;
  expiresAt: string;
};
type OwnSignIn = { checkId: string; status: string; matchNumber: number; expiresAt: string } | null;
type Outcome = "confirmed" | "denied" | "mismatch" | "wrong_number" | "expired" | "error";

const POLL_MS = 15_000;
const DEVICE_FLAG = "tk.security.device.v1";
const HIDDEN_KEY = "tk.security.hidden";

const T = {
  supportTitle: { fr: "Êtes-vous en contact avec le soutien TAKATAK ?", en: "Are you in contact with TAKATAK support?" },
  supportBody: {
    fr: "Nous voulons nous assurer que c’est bien vous. Touchez le nombre que le conseiller vous donne au téléphone.",
    en: "We are making sure it is really you. Tap the number the agent gives you on the phone.",
  },
  supportNo: { fr: "Non, je ne parle pas au soutien", en: "No, I am not talking to support" },
  signInTitle: { fr: "Nouvelle connexion à votre compte", en: "New sign-in to your account" },
  signInBody: {
    fr: "C’était vous ? Touchez le nombre affiché sur l’autre appareil.",
    en: "Was it you? Tap the number shown on the other device.",
  },
  signInNo: { fr: "Ce n’était pas moi", en: "It wasn’t me" },
  device: { fr: "Appareil", en: "Device" },
  when: { fr: "Quand", en: "When" },
  network: { fr: "Réseau", en: "Network" },
  never: {
    fr: "TAKATAK ne vous demandera jamais votre code de connexion, ni par téléphone, ni par courriel, ni par texto.",
    en: "TAKATAK will never ask for your sign-in code, by phone, email or text message.",
  },
  wrong: { fr: "Ce n’est pas le bon nombre. Il vous reste {n} essai.", en: "That is not the right number. {n} try left." },
  supportConfirmed: { fr: "C’est confirmé. Le conseiller voit que c’est bien vous.", en: "Confirmed. The agent can see it is really you." },
  supportDenied: {
    fr: "Merci. Ne donnez aucune information à cette personne et raccrochez. Écrivez-nous à support@takatak.ca.",
    en: "Thank you. Give this person no information and hang up. Write to us at support@takatak.ca.",
  },
  supportMismatch: {
    fr: "Ce n’est pas le bon nombre. Le conseiller est averti. Si on vous demande un code ou un paiement, raccrochez.",
    en: "Not the right number. The agent has been told. If anyone asks for a code or a payment, hang up.",
  },
  signInConfirmed: { fr: "Connexion approuvée. Merci !", en: "Sign-in approved. Thank you!" },
  signInClosed: {
    fr: "Vos autres sessions sont fermées (au plus tard d’ici une heure). Si quelqu’un a accès à votre courriel ou à votre téléphone, changez-en le mot de passe et écrivez-nous à support@takatak.ca.",
    en: "Your other sessions are closed (within one hour at most). If someone can access your email or phone, change its password and write to us at support@takatak.ca.",
  },
  signInNotClosed: {
    fr: "Nous n’avons pas pu fermer vos autres sessions automatiquement. Écrivez tout de suite à support@takatak.ca.",
    en: "We could not close your other sessions automatically. Write to support@takatak.ca right away.",
  },
  expired: { fr: "Cette question a expiré.", en: "This question has expired." },
  error: { fr: "La réponse n’a pas pu être envoyée. Réessayez.", en: "The answer could not be sent. Try again." },
  close: { fr: "Fermer", en: "Close" },
  ownTitle: { fr: "Confirmez cette connexion", en: "Confirm this sign-in" },
  ownBody: {
    fr: "Sur votre autre appareil déjà connecté, touchez ce nombre :",
    en: "On your other signed-in device, tap this number:",
  },
  ownLater: { fr: "Vous pouvez continuer ici en attendant.", en: "You can keep working here meanwhile." },
  hide: { fr: "Masquer", en: "Hide" },
  approvedTitle: { fr: "Connexion approuvée", en: "Sign-in approved" },
  approvedBody: {
    fr: "Vous pouvez retourner à votre autre appareil, ou continuer ici.",
    en: "You can return to your other device, or continue here.",
  },
  continue: { fr: "Continuer ici", en: "Continue here" },
  refusedTitle: { fr: "Connexion refusée", en: "Sign-in refused" },
  refusedBody: {
    fr: "Cette connexion a été refusée sur votre autre appareil. Par sécurité, déconnectez-vous.",
    en: "This sign-in was refused on your other device. For safety, sign out.",
  },
  signOut: { fr: "Me déconnecter", en: "Sign out" },
} as const;

function readLang(): Lang {
  try {
    const stored = window.localStorage.getItem("takatak.lang");
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    /* storage may be unavailable */
  }
  return document.documentElement.lang.startsWith("en") ? "en" : "fr";
}

function hiddenIds(): string[] {
  try {
    return JSON.parse(window.sessionStorage.getItem(HIDDEN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function hide(id: string) {
  try {
    window.sessionStorage.setItem(HIDDEN_KEY, JSON.stringify([...hiddenIds(), id].slice(-20)));
  } catch {
    /* ignore */
  }
}

const when = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long", timeStyle: "short" });

export function SecurityPrompts() {
  const [lang, setLang] = useState<Lang>("fr");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [own, setOwn] = useState<OwnSignIn>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ id: string; kind: Prompt["kind"]; result: Outcome; left?: number; closed?: boolean } | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const stopped = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (stopped.current || document.visibilityState === "hidden") return;
    try {
      const res = await fetch("/api/security/prompts", { cache: "no-store" });
      if (res.status === 401) {
        stopped.current = true;
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { prompts?: Prompt[]; ownSignIn?: OwnSignIn };
      setPrompts(data.prompts ?? []);
      setOwn(data.ownSignIn ?? null);
    } catch {
      /* offline: try again on the next tick */
    }
  }, []);

  useEffect(() => {
    setLang(readLang());
    setHidden(hiddenIds());
    let cancelled = false;
    const start = async () => {
      // Once per browser session: tell the server which browser this is.
      let flagged = false;
      try {
        flagged = window.sessionStorage.getItem(DEVICE_FLAG) === "1";
      } catch {
        /* ignore */
      }
      if (!flagged) {
        try {
          const res = await fetch("/api/security/device", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          if (res.ok) window.sessionStorage.setItem(DEVICE_FLAG, "1");
          if (res.status === 401) stopped.current = true;
        } catch {
          /* ignore: retried next session */
        }
      }
      if (!cancelled) await refresh();
    };
    void start();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  const answer = async (prompt: Prompt, value: number | "not_me") => {
    setBusy(true);
    try {
      const res = await fetch(`/api/security/prompts/${prompt.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: value }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; code?: string; attemptsLeft?: number; otherSessionsClosed?: boolean };
      if (data.status === "wrong_number") {
        setOutcome({ id: prompt.id, kind: prompt.kind, result: "wrong_number", left: data.attemptsLeft ?? 1 });
      } else if (data.status === "confirmed" || data.status === "denied" || data.status === "mismatch") {
        setOutcome({ id: prompt.id, kind: prompt.kind, result: data.status, closed: data.otherSessionsClosed === true });
        setPrompts((list) => list.filter((p) => p.id !== prompt.id));
      } else if (data.code === "expired" || data.code === "closed") {
        setOutcome({ id: prompt.id, kind: prompt.kind, result: "expired" });
        setPrompts((list) => list.filter((p) => p.id !== prompt.id));
      } else {
        setOutcome({ id: prompt.id, kind: prompt.kind, result: "error" });
      }
    } catch {
      setOutcome({ id: prompt.id, kind: prompt.kind, result: "error" });
    } finally {
      setBusy(false);
    }
  };

  const current = prompts[0] ?? null;
  const final = outcome && outcome.result !== "wrong_number" && outcome.result !== "error" ? outcome : null;
  const t = <K extends keyof typeof T>(key: K) => T[key][lang];
  const shownId = final ? `done:${final.id}` : current?.id ?? null;

  // Focus goes to the dialog when a new question (or its answer) appears, never to a number:
  // no number may look pre-selected, and polling must not move the focus.
  useEffect(() => {
    if (shownId) dialogRef.current?.focus();
  }, [shownId]);

  // 1. A question for this device (or the answer it just gave).
  if (current || final) {
    const kind = final ? final.kind : current!.kind;
    const support = kind === "support_identity";
    const titleId = "security-prompt-title";
    return (
      <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          ref={dialogRef}
          className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl outline-none"
        >
          <div className="flex items-start gap-3">
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
                final?.result === "denied" || final?.result === "mismatch" ? "bg-red-50 text-red-700" : "bg-[#EAF2FF] text-[#1565D8]"
              }`}
            >
              {final?.result === "confirmed" ? (
                <CheckCircle2 size={22} aria-hidden />
              ) : final && final.result !== "expired" ? (
                <ShieldAlert size={22} aria-hidden />
              ) : support ? (
                <Headset size={22} aria-hidden />
              ) : (
                <ShieldCheck size={22} aria-hidden />
              )}
            </span>
            <h2 id={titleId} className="pt-1 text-lg font-semibold leading-snug text-slate-950">
              {support ? t("supportTitle") : t("signInTitle")}
            </h2>
          </div>

          {final ? (
            <div className="mt-4">
              <p className="text-[15px] leading-6 text-slate-700" role="status">
                {final.result === "expired"
                  ? t("expired")
                  : support
                    ? final.result === "confirmed"
                      ? t("supportConfirmed")
                      : final.result === "denied"
                        ? t("supportDenied")
                        : t("supportMismatch")
                    : final.result === "confirmed"
                      ? t("signInConfirmed")
                      : final.closed
                        ? t("signInClosed")
                        : t("signInNotClosed")}
              </p>
              <button
                type="button"
                onClick={() => setOutcome(null)}
                className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {t("close")}
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-[15px] leading-6 text-slate-700">{support ? t("supportBody") : t("signInBody")}</p>
              {!support && (
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-2xl bg-slate-50 p-3 text-sm">
                  <dt className="text-slate-500">{t("device")}</dt>
                  <dd className="flex items-center gap-1.5 font-medium text-slate-900">
                    <MonitorSmartphone size={14} aria-hidden /> {current!.deviceLabel ?? "—"}
                  </dd>
                  <dt className="text-slate-500">{t("when")}</dt>
                  <dd className="text-slate-900">{when(current!.createdAt, lang)}</dd>
                  {current!.ipHint && (
                    <>
                      <dt className="text-slate-500">{t("network")}</dt>
                      <dd className="text-slate-900">{current!.ipHint}</dd>
                    </>
                  )}
                </dl>
              )}
              <div className="mt-4 grid grid-cols-3 gap-3" role="group" aria-label={support ? t("supportBody") : t("signInBody")}>
                {current!.choices.map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={busy}
                    onClick={() => void answer(current!, n)}
                    className="rounded-2xl border-2 border-slate-200 bg-white py-4 text-3xl font-bold tabular-nums text-slate-950 transition hover:border-[#1565D8] hover:bg-[#EAF2FF] focus-visible:border-[#1565D8] focus-visible:outline-none disabled:opacity-60"
                  >
                    {n}
                  </button>
                ))}
              </div>
              {outcome?.id === current!.id && outcome.result === "wrong_number" && (
                <p className="mt-3 text-sm font-medium text-red-700" role="alert">
                  {t("wrong").replace("{n}", String(outcome.left ?? 1))}
                </p>
              )}
              {outcome?.id === current!.id && outcome.result === "error" && (
                <p className="mt-3 text-sm font-medium text-red-700" role="alert">
                  {t("error")}
                </p>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void answer(current!, "not_me")}
                className="mt-4 w-full rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                {support ? t("supportNo") : t("signInNo")}
              </button>
              <p className="mt-4 text-xs leading-5 text-slate-500">{t("never")}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. This is the new device: the number to tap elsewhere, then the result.
  if (own && !hidden.includes(`${own.checkId}:${own.status}`)) {
    const dismiss = () => {
      hide(`${own.checkId}:${own.status}`);
      setHidden(hiddenIds());
    };
    // The server closes expired checks before answering, so "pending" is still open.
    if (own.status === "pending") {
      return (
        <aside
          aria-labelledby="security-own-title"
          className="fixed bottom-4 right-4 z-[90] w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <p id="security-own-title" className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <ShieldCheck size={18} className="text-[#1565D8]" aria-hidden /> {t("ownTitle")}
            </p>
            <button type="button" onClick={dismiss} aria-label={t("hide")} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
              <X size={16} aria-hidden />
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-600">{t("ownBody")}</p>
          <p className="mt-3 text-center text-5xl font-bold tabular-nums tracking-tight text-slate-950" aria-live="polite">
            {own.matchNumber}
          </p>
          <p className="mt-3 text-xs text-slate-500">{t("ownLater")}</p>
        </aside>
      );
    }
    if (own.status === "confirmed") {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="security-approved-title" className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl">
            <CheckCircle2 size={44} className="mx-auto text-emerald-700" aria-hidden />
            <h2 id="security-approved-title" className="mt-3 text-xl font-semibold text-slate-950">
              {t("approvedTitle")}
            </h2>
            <p className="mt-2 text-[15px] leading-6 text-slate-600">{t("approvedBody")}</p>
            <button
              type="button"
              autoFocus
              onClick={dismiss}
              className="mt-6 w-full rounded-xl bg-[#1565D8] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1257bb]"
            >
              {t("continue")}
            </button>
          </div>
        </div>
      );
    }
    if (own.status === "denied" || own.status === "mismatch") {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-labelledby="security-refused-title" className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl">
            <ShieldAlert size={44} className="mx-auto text-red-700" aria-hidden />
            <h2 id="security-refused-title" className="mt-3 text-xl font-semibold text-slate-950">
              {t("refusedTitle")}
            </h2>
            <p className="mt-2 text-[15px] leading-6 text-slate-600">{t("refusedBody")}</p>
            <form action="/auth/signout" method="post">
              <button type="submit" autoFocus className="mt-6 w-full rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-800">
                {t("signOut")}
              </button>
            </form>
          </div>
        </div>
      );
    }
  }
  return null;
}
