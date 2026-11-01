"use client";

import Image from "next/image";
import { useEffect, useId, useState, type FormEvent } from "react";
import { ArrowRight, Check, Loader2, MailCheck } from "lucide-react";

import { useCopy } from "@/components/website/premium/ui";
import { NEWSLETTER_TOPICS, TOPIC_LABELS, type NewsletterTopic } from "@/lib/newsletter/topics";
import { Link } from "@/lib/website/nav";
import { Eyebrow, RevealMedia, Rise, TwoTone } from "./primitives";
import { PushAlert } from "./PushAlert";

type Info =
  | { state: "loading" }
  | { state: "off" }
  | { state: "on"; version: string; text: { fr: string; en: string } };

const t = {
  eyebrow: { fr: "Infolettre", en: "Newsletter" },
  lead: { fr: "Les vraies offres,", en: "Real offers," },
  rest: { fr: "avant tout le monde.", en: "before everyone else." },
  body: {
    fr: "Un courriel quand une vraie promotion commence, des leçons de la TAKATAK Academy et nos nouveaux services. Vous choisissez les sujets ; le désabonnement est dans chaque courriel.",
    en: "An email when a real promotion starts, TAKATAK Academy lessons and our new services. You pick the topics; the unsubscribe link is in every email.",
  },
  topics: { fr: "Je veux recevoir", en: "I want to receive" },
  email: { fr: "Votre courriel", en: "Your email" },
  placeholder: { fr: "vous@entreprise.ca", en: "you@business.ca" },
  submit: { fr: "M'inscrire", en: "Subscribe" },
  separate: {
    fr: "Ce consentement vaut pour les courriels seulement. Les notifications et les textos se demandent à part, jamais d'office.",
    en: "This consent covers email only. Notifications and text messages are asked for separately, never by default.",
  },
  privacy: { fr: "Politique de confidentialité", en: "Privacy policy" },
  needConsent: { fr: "Cochez la case pour vous inscrire.", en: "Tick the box to subscribe." },
  badEmail: { fr: "Vérifiez l'adresse courriel.", en: "Check the email address." },
  failed: { fr: "L'inscription n'a pas fonctionné. Réessayez dans un moment.", en: "Sign-up did not go through. Try again in a moment." },
  reworded: {
    fr: "Le texte du consentement vient de changer : relisez-le et cochez la case de nouveau.",
    en: "The consent wording just changed: read it and tick the box again.",
  },
  busy: { fr: "Trop d'essais d'un coup. Réessayez dans quelques minutes.", en: "Too many tries at once. Try again in a few minutes." },
  soon: {
    fr: "Les inscriptions ouvrent très bientôt. En attendant, écrivez-nous à support@takatak.ca.",
    en: "Sign-ups open very soon. Meanwhile, write to support@takatak.ca.",
  },
  doneTitle: { fr: "Presque fini.", en: "Almost done." },
  doneBody: {
    fr: "Ouvrez le courriel que nous venons de vous envoyer et cliquez sur « Confirmer ». Sans confirmation, vous ne recevrez rien.",
    en: "Open the email we just sent you and click “Confirm”. Without confirmation, you will receive nothing.",
  },
  previewTag: { fr: "Aperçu d'un courriel", en: "Email preview" },
  previewSubject: { fr: "Bienvenue : 10 % sur votre premier achat", en: "Welcome: 10% off your first purchase" },
  previewLine: {
    fr: "Code FIRST10, une fois par compte, sur les services admissibles.",
    en: "Code FIRST10, once per account, on eligible services.",
  },
  photoAlt: { fr: "Dans un atelier de couture, au téléphone devant l'ordinateur", en: "In a sewing studio, on the phone at the laptop" },
};


async function loadInfo(): Promise<Info> {
  try {
    const r = await fetch("/api/public/newsletter", { cache: "no-store" });
    const d = (await r.json()) as { enabled?: boolean; consentVersion?: string; consentText?: { fr: string; en: string } };
    return d.enabled && d.consentVersion && d.consentText ? { state: "on", version: d.consentVersion, text: d.consentText } : { state: "off" };
  } catch {
    return { state: "off" };
  }
}

/** The sign-up form: its own unchecked consent box, double opt-in, proof kept server-side. */
export function NewsletterForm({
  sourcePage = "/",
  fixedTopics,
  className = "mt-10",
}: {
  sourcePage?: string;
  /** Deal alerts pass ["offers"]: no topic picker. */
  fixedTopics?: NewsletterTopic[];
  className?: string;
}) {
  const { lang } = useCopy();
  const ids = { email: useId(), consent: useId(), error: useId() };
  const [info, setInfo] = useState<Info>({ state: "loading" });
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [topics, setTopics] = useState<NewsletterTopic[]>(fixedTopics ?? [...NEWSLETTER_TOPICS]);
  const [honey, setHoney] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadInfo().then((next) => live && setInfo(next));
    return () => {
      live = false;
    };
  }, []);

  const toggleTopic = (k: NewsletterTopic) =>
    setTopics((cur) => (cur.includes(k) ? (cur.length > 1 ? cur.filter((x) => x !== k) : cur) : [...cur, k]));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (info.state !== "on" || status === "sending") return;
    if (!consent) return setError(t.needConsent[lang]);
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/public/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent: true, consentVersion: info.version, language: lang, topics, sourcePage, website: honey }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; fieldErrors?: Record<string, string> };
      if (res.ok && data.ok) return setStatus("done");
      setStatus("idle");
      if (data.fieldErrors?.consentVersion) {
        // The wording changed since the page loaded: show the new text and ask again.
        setInfo(await loadInfo());
        setConsent(false);
        return setError(t.reworded[lang]);
      }
      setError(data.fieldErrors?.email ? t.badEmail[lang] : res.status === 429 ? t.busy[lang] : t.failed[lang]);
    } catch {
      setStatus("idle");
      setError(t.failed[lang]);
    }
  }

  const off = info.state !== "on";

  return (
    <>
    {status === "done" ? (
      <div role="status" className={`hp-card flex items-start gap-4 rounded-[24px] p-6 ${className}`}>
        <MailCheck size={28} className="hp-accent shrink-0" aria-hidden />
        <div>
          <p className="hp-display text-[24px]">{t.doneTitle[lang]}</p>
          <p className="hp-ink-2 mt-2 text-[15px] leading-7">{t.doneBody[lang]}</p>
        </div>
      </div>
    ) : (
      <form onSubmit={submit} noValidate className={`grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 ${className}`}>
        {!fixedTopics && (
        <fieldset className="min-w-0">
          <legend className="hp-ink-3 text-[13px] font-semibold">{t.topics[lang]}</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {NEWSLETTER_TOPICS.map((k) => {
              const on = topics.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTopic(k)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-medium transition-all ${on ? "hp-btn" : "hp-card hp-ink-2 hover:shadow-[var(--hp-shadow)]"}`}
                >
                  {on && <Check size={14} strokeWidth={3} aria-hidden />} {TOPIC_LABELS[k][lang]}
                </button>
              );
            })}
          </div>
        </fieldset>
        )}

        <div>
          <label htmlFor={ids.email} className="hp-ink-3 text-[13px] font-semibold">{t.email[lang]}</label>
          <div className="hp-card mt-2 flex items-center gap-2 rounded-full p-1.5 pl-5 shadow-[var(--hp-shadow)] focus-within:ring-2 focus-within:ring-[var(--hp-cta)]">
            <input
              id={ids.email}
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.placeholder[lang]}
              disabled={off}
              aria-describedby={error ? ids.error : undefined}
              className="hp-ink min-w-0 flex-1 bg-transparent py-2.5 text-[16px] outline-none placeholder:text-[var(--hp-ink-3)] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={off || status === "sending" || !consent || !email}
              className="hp-cta inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-3 text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "sending" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
              {t.submit[lang]} <ArrowRight size={16} aria-hidden />
            </button>
          </div>
        </div>

        {/* Hidden from people; bots fill it. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honey} onChange={(e) => setHoney(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />

        {info.state === "on" ? (
          <label htmlFor={ids.consent} className="flex cursor-pointer items-start gap-3">
            <input
              id={ids.consent}
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                if (e.target.checked) setError(null);
              }}
              className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[var(--hp-cta)]"
            />
            <span className="hp-ink-2 min-w-0 break-words text-[13.5px] leading-6">{info.text[lang]}</span>
          </label>
        ) : info.state === "off" ? (
          <p className="hp-ink-2 text-[14px] leading-6">{t.soon[lang]}</p>
        ) : (
          <p className="hp-ink-3 text-[14px]" aria-busy>…</p>
        )}

        {error && (
          <p id={ids.error} role="alert" className="hp-warn text-[14px] font-medium">
            {error}
          </p>
        )}

        <p className="hp-ink-3 text-[13.5px] leading-5">
          {t.separate[lang]}{" "}
          <Link to="/privacy" className="underline underline-offset-4 hover:text-[var(--hp-ink)]">
            {t.privacy[lang]}
          </Link>
        </p>
      </form>
    )}
    </>
  );
}

/** Newsletter sign-up: its own unchecked consent box, double opt-in, proof kept server-side. */
export function NewsletterSignup({ sourcePage = "/" }: { sourcePage?: string }) {
  const { lang } = useCopy();
  return (
    <section id="infolettre" aria-labelledby="newsletter-title" className="hp-bg hp-live px-4 py-14 sm:py-20" style={{ scrollMarginTop: "calc(var(--tk-header-h, 64px) + 56px)" }}>
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
        {/* Picture + an honest preview of a real email (the FIRST10 welcome offer exists). */}
        <Rise className="relative min-w-0">
          <RevealMedia className="aspect-[4/5] shadow-[var(--hp-shadow)] sm:aspect-[5/4] lg:aspect-[4/5]">
            <div className="hp-parallax absolute inset-0">
              <Image src="/photos/studio-design.webp" alt={t.photoAlt[lang]} fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" style={{ objectPosition: "55% 40%" }} />
            </div>
          </RevealMedia>
          <div className="hp-card hp-ink absolute bottom-5 left-5 right-5 rounded-2xl p-4 shadow-[0_24px_60px_-24px_rgba(11,13,18,0.45)] sm:bottom-8 sm:left-auto sm:right-8 sm:w-[340px]">
            <p className="hp-ink-3 text-[11px] font-semibold uppercase tracking-[0.18em]">{t.previewTag[lang]}</p>
            <div className="mt-3 flex items-start gap-3">
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--hp-cta)] text-[13px] font-bold text-white">T</span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold">Groupe TAKATAK</p>
                <p className="truncate text-[14px] font-semibold">{t.previewSubject[lang]}</p>
                <p className="hp-ink-2 mt-0.5 text-[13px] leading-5">{t.previewLine[lang]}</p>
              </div>
            </div>
          </div>
        </Rise>

        <Rise className="min-w-0">
          <Eyebrow>{t.eyebrow[lang]}</Eyebrow>
          <TwoTone id="newsletter-title" lead={t.lead[lang]} rest={t.rest[lang]} />
          <p className="hp-ink-2 mt-6 max-w-xl text-[17px] leading-8">{t.body[lang]}</p>

          <NewsletterForm sourcePage={sourcePage} />
        </Rise>
      </div>
    </section>
  );
}

const deal = {
  eyebrow: { fr: "Alertes promo", en: "Deal alerts" },
  title: { fr: "Soyez averti quand une vraie promotion commence.", en: "Get told when a real promotion starts." },
  body: {
    fr: "Un courriel au lancement de chaque promotion, avec son pourcentage et sa date de fin. Rien d'autre.",
    en: "One email when each promotion starts, with its percentage and end date. Nothing else.",
  },
};

/** Deal alerts: the newsletter limited to offers, for campaign and order pages. */
export function DealAlert({ sourcePage, className = "" }: { sourcePage: string; className?: string }) {
  const { lang } = useCopy();
  return (
    <aside aria-label={deal.eyebrow[lang]} className={`hp-card hp-ink rounded-[28px] p-6 sm:p-8 ${className}`}>
      <p className="hp-accent text-[13px] font-semibold uppercase tracking-[0.18em]">{deal.eyebrow[lang]}</p>
      <p className="hp-display mt-2 text-[24px] leading-tight sm:text-[28px]">{deal.title[lang]}</p>
      <p className="hp-ink-2 mt-2 text-[15px] leading-7">{deal.body[lang]}</p>
      <NewsletterForm sourcePage={sourcePage} fixedTopics={["offers"]} className="mt-5" />
      <PushAlert sourcePage={sourcePage} />
    </aside>
  );
}
