"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, Lock, Search, Sparkles } from "lucide-react";

import { money } from "@/components/website/premium/ui";
import { MIMT_PLAN_LIST } from "@/lib/website/mimt-plans";
import {
  MIMT_API_URL,
  MIMT_APP_URL,
  NUMBER_HOLD_MINUTES,
  appHandoffUrl,
  formatNanp,
  memorable,
  numberErrorText,
  placeName,
  type HoldPlan,
  type NumberHoldResponse,
  type PublicNumber,
  type PublicNumberSearchResponse,
} from "@/lib/website/mimt-numbers";

type Lang = "fr" | "en";

const CHIPS = ["514", "438", "450", "418", "819", "Toronto"];
const BUSINESS_TYPES = [
  { value: "restaurant", fr: "Restaurant", en: "Restaurant" },
  { value: "retail", fr: "Commerce", en: "Retail store" },
  { value: "professional", fr: "Services professionnels", en: "Professional services" },
  { value: "health", fr: "Santé / clinique", en: "Health / clinic" },
  { value: "other", fr: "Autre", en: "Other" },
] as const;

type State =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "results"; data: PublicNumberSearchResponse }
  | { kind: "error"; message: string };

/**
 * The MIMT live number search, as on mimt.ca: type an area code or a city,
 * see real numbers from the carrier, pick one and it is held for 10 minutes
 * (server timer), then continue in the MIMT app to sign up and pay.
 */
export const MimtNumberPicker = forwardRef<HTMLInputElement, { lang: Lang; plan: HoldPlan }>(function MimtNumberPicker({ lang, plan }, inputRef) {
  const fr = lang === "fr";
  const [q, setQ] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [hold, setHold] = useState<NumberHoldResponse | null>(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [bizName, setBizName] = useState("");
  const [bizType, setBizType] = useState<string>("restaurant");
  const seq = useRef(0);

  async function search(query: string) {
    const term = query.trim();
    if (term.length < 2) return setState({ kind: "idle" });
    const mine = ++seq.current;
    setState({ kind: "searching" });
    try {
      const res = await fetch(`${MIMT_API_URL}/v1/public/numbers/search?q=${encodeURIComponent(term)}`);
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (mine !== seq.current) return;
      setState(res.ok ? { kind: "results", data: body as PublicNumberSearchResponse } : { kind: "error", message: numberErrorText(body.error, fr) });
    } catch {
      if (mine === seq.current) setState({ kind: "error", message: numberErrorText(undefined, fr) });
    }
  }

  // Search as the visitor types (debounced), only for something that can be a place or an area code.
  useEffect(() => {
    const term = q.trim();
    if (!/^\(?\d{3}\)?$/.test(term) && term.replace(/\d/g, "").length < 3) return;
    const t = window.setTimeout(() => void search(term), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // The hold ring follows the server's expiry.
  useEffect(() => {
    if (!hold) return;
    const tick = () => setLeft(Math.max(0, Math.round((Date.parse(hold.expiresAt) - Date.now()) / 1000)));
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [hold]);

  async function pick(n: PublicNumber) {
    setBusy(n.e164);
    try {
      const res = await fetch(`${MIMT_API_URL}/v1/public/numbers/holds`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ e164: n.e164 }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setState({ kind: "error", message: numberErrorText(body.error, fr) });
        return;
      }
      setHold(body as NumberHoldResponse);
    } catch {
      setState({ kind: "error", message: numberErrorText(undefined, fr) });
    } finally {
      setBusy(null);
    }
  }

  function release() {
    if (hold?.token) {
      void fetch(`${MIMT_API_URL}/v1/public/numbers/holds/${hold.id}`, { method: "DELETE", headers: { "x-hold-token": hold.token } }).catch(() => {});
    }
    setHold(null);
  }

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  const chosen = MIMT_PLAN_LIST[plan === "business" ? "business" : plan];

  if (hold) {
    const expired = left <= 0;
    const share = left / (NUMBER_HOLD_MINUTES * 60);
    return (
      <div className="tk-fade-in rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/10" aria-live="polite">
        {expired ? (
          <>
            <p className="text-[16px] font-semibold text-white">{fr ? "La réservation a expiré." : "The hold has expired."}</p>
            <button type="button" onClick={() => setHold(null)} className="mt-3 rounded-full bg-white px-4 py-2 text-[14px] font-semibold text-[#060D1F]">
              {fr ? "Choisir un numéro" : "Pick a number"}
            </button>
          </>
        ) : (
          <>
            <ol className="flex gap-2 text-[11.5px] font-semibold uppercase tracking-wide" aria-label={fr ? "Étapes" : "Steps"}>
              {[fr ? "Réservé" : "Held", fr ? "Compte" : "Account", "9-1-1", fr ? "Paiement" : "Payment"].map((s, i) => (
                <li key={s} className={`rounded-full px-2.5 py-1 ${i === 0 ? "bg-emerald-500 text-white" : "bg-white/10 text-white/55"}`}>
                  {s}
                </li>
              ))}
            </ol>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#7FD8FF]">{fr ? "Réservé pour vous" : "Held for you"}</p>
                <p className="hp-display mt-1 text-[34px] leading-none tabular-nums text-white">{formatNanp(hold.e164, lang)}</p>
              </div>
              <div className="relative grid h-16 w-16 place-items-center" role="timer" aria-label={fr ? `Réservé encore ${mm} minutes ${ss} secondes` : `Held for ${mm} more minutes ${ss} seconds`}>
                <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden>
                  <circle cx="22" cy="22" r="19" fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="3" />
                  <circle cx="22" cy="22" r="19" fill="none" stroke="#29C3FF" strokeWidth="3" strokeLinecap="round" pathLength={100} strokeDasharray={`${share * 100} 100`} />
                </svg>
                <time className="text-[13px] font-semibold tabular-nums text-white" dateTime={`PT${mm}M${ss}S`}>
                  {mm}:{ss}
                </time>
              </div>
            </div>
            <p className="mt-2 text-[13px] text-white/55">{fr ? "Personne d'autre chez MIMT ne peut le prendre pendant ce temps." : "No one else at MIMT can take it in the meantime."}</p>
            <ul className="mt-3 grid gap-1 text-[13.5px] text-white/80">
              <li>
                <strong className="text-white">
                  MIMT {chosen.name[lang]} · {money(lang, chosen.monthlyCents / 100)}
                  {chosen.perLine ? (fr ? " / ligne / mois" : " / line / month") : fr ? " / mois" : " / month"}
                </strong>{" "}
                {fr ? "avant taxes, sans contrat" : "before tax, no contract"}
              </li>
              <li>{fr ? "Activé dès le paiement, sur cellulaire et ordinateur" : "Live as soon as you pay, on phone and computer"}</li>
              <li>{fr ? "Annulable en tout temps depuis votre compte" : "Cancel any time from your account"}</li>
            </ul>
            {plan === "business" && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-[12.5px] text-white/60">
                  {fr ? "Nom de votre entreprise (facultatif)" : "Your business name (optional)"}
                  <input
                    maxLength={120}
                    autoComplete="organization"
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    className="rounded-xl bg-white/[0.06] px-3 py-2 text-[14px] text-white ring-1 ring-white/15 focus:outline-none focus:ring-[#29C3FF]"
                  />
                </label>
                <label className="grid gap-1 text-[12.5px] text-white/60">
                  {fr ? "Type d'entreprise" : "Type of business"}
                  <select
                    value={bizType}
                    onChange={(e) => setBizType(e.target.value)}
                    className="rounded-xl bg-white/[0.06] px-3 py-2 text-[14px] text-white ring-1 ring-white/15 focus:outline-none focus:ring-[#29C3FF]"
                  >
                    {BUSINESS_TYPES.map((b) => (
                      <option key={b.value} value={b.value} className="text-black">
                        {fr ? b.fr : b.en}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <a
              href={appHandoffUrl(hold, plan, { name: bizName, type: bizType })}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3.5 text-[15px] font-semibold text-[#060D1F] transition-transform hover:scale-[1.02]"
            >
              {fr ? "Continuer : créer mon compte" : "Continue: create my account"} <ArrowRight size={16} aria-hidden />
            </a>
            <button type="button" onClick={release} className="mt-2 w-full text-center text-[13px] font-semibold text-white/60 underline-offset-4 hover:text-white hover:underline">
              {fr ? "Choisir un autre numéro" : "Pick another number"}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void search(q);
        }}
      >
        <label htmlFor="home-mimt-number" className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#7FD8FF]">
          <Sparkles size={13} aria-hidden /> {fr ? "Choisissez votre numéro, en direct" : "Choose your number, live"}
        </label>
        <div className="mt-3 flex items-center gap-2 rounded-full bg-white/[0.06] p-1.5 pl-4 ring-1 ring-white/15 focus-within:ring-[#29C3FF]">
          <Search size={18} className="shrink-0 text-white/50" aria-hidden />
          <input
            id="home-mimt-number"
            ref={inputRef}
            inputMode="search"
            autoComplete="off"
            placeholder={fr ? "Indicatif ou ville : 514, Québec, Gatineau…" : "Area code or city: 514, Toronto, Ottawa…"}
            value={q}
            maxLength={60}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-white placeholder:text-white/40 focus:outline-none"
          />
          <button type="submit" className="shrink-0 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-[#060D1F]">
            {fr ? "Chercher" : "Search"}
          </button>
        </div>
      </form>
      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Suggestions">
        {CHIPS.map((c) => (
          <li key={c}>
            <button
              type="button"
              onClick={() => {
                setQ(c);
                void search(c);
              }}
              className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[13px] font-semibold text-white/75 ring-1 ring-white/10 hover:bg-white/[0.12] hover:text-white"
            >
              {c}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 min-h-[56px]" aria-live="polite">
        {state.kind === "searching" && (
          <p className="flex items-center gap-2 text-[14px] text-white/60">
            <Loader2 size={15} className="animate-spin" aria-hidden /> {fr ? "Recherche…" : "Searching…"}
          </p>
        )}
        {state.kind === "error" && (
          <p className="rounded-2xl bg-amber-400/10 px-4 py-2.5 text-[14px] text-amber-200">
            {state.message}{" "}
            <a href={`${MIMT_APP_URL}/numero`} target="_blank" rel="noopener noreferrer" className="font-semibold text-white underline underline-offset-4">
              {fr ? "Choisir dans l'app MIMT" : "Pick it in the MIMT app"}
            </a>
          </p>
        )}
        {state.kind === "idle" && (
          <p className="flex items-center gap-2 text-[13.5px] text-white/45">
            <Lock size={13} aria-hidden />
            {fr
              ? `Vrais numéros du fournisseur. Un clic en réserve un ${NUMBER_HOLD_MINUTES} minutes.`
              : `Real numbers from the carrier. One click holds it for ${NUMBER_HOLD_MINUTES} minutes.`}
          </p>
        )}
        {state.kind === "results" &&
          (state.data.numbers.length ? (
            <>
              {state.data.fallback && <p className="mb-2 text-[13px] text-[#7FD8FF]">{state.data.fallback.message[lang]}</p>}
              <p className="text-[13px] text-white/55">
                {fr
                  ? `${state.data.numbers.length} numéros libres maintenant · ${state.data.fallback ? state.data.fallback.to : state.data.label.fr}`
                  : `${state.data.numbers.length} numbers free right now · ${state.data.fallback ? state.data.fallback.to : state.data.label.en}`}
              </p>
              <ul className="mt-2 grid max-h-[300px] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                {state.data.numbers.map((n, i) => {
                  const lucky = memorable(n.e164, fr);
                  return (
                    <li key={n.e164} className="tk-fade-in" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void pick(n)}
                        className="group flex w-full items-center gap-3 rounded-2xl bg-white/[0.04] px-3.5 py-2.5 text-left ring-1 ring-white/10 transition-colors hover:bg-white/[0.1] hover:ring-[#29C3FF]/50 disabled:opacity-60"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[16px] font-semibold tabular-nums text-white">{formatNanp(n.e164, lang)}</span>
                          <span className="block truncate text-[12px] text-white/50">
                            {placeName(n.e164, n.locality, n.region, fr)}
                            {lucky && <span className="ml-1.5 text-[#7FD8FF]">✦ {lucky}</span>}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-semibold text-white group-hover:bg-white group-hover:text-[#060D1F]">
                          {busy === n.e164 ? "…" : fr ? "Réserver" : "Hold"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="text-[14px] text-white/60">
              {fr ? "Aucun numéro libre pour l'instant à cet endroit. Essayez un indicatif voisin." : "No free number there right now. Try a nearby area code."}
            </p>
          ))}
      </div>
      <noscript>
        <p className="text-[13px] text-white/60">
          <a href={`${MIMT_APP_URL}/numero`}>{fr ? "Choisissez votre numéro dans l'app MIMT" : "Pick your number in the MIMT app"}</a>
        </p>
      </noscript>
    </div>
  );
});
