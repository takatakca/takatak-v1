"use client";

import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { useId, useState } from "react";

import { useAuth } from "@/lib/website/auth-context";
import { CONTACT_TOPICS, contactCategory, contactTitle, type ContactTopic } from "@/lib/website/contact-topics";
import { SUPPORT_EMAIL } from "@/lib/website/live-chat-config";
import { useLanguage } from "@/lib/website/use-language";
import { submitWebsiteRequest } from "@/lib/website/website-requests";

type Bi = { en: string; fr: string };


const COPY = {
  topic: { en: "Subject", fr: "Sujet" },
  name: { en: "Your name", fr: "Votre nom" },
  email: { en: "Email", fr: "Courriel" },
  phone: { en: "Phone (optional)", fr: "Téléphone (facultatif)" },
  company: { en: "Business (optional)", fr: "Entreprise (facultatif)" },
  message: { en: "Your message", fr: "Votre message" },
  messageHint: { en: "What you need, in a few words.", fr: "Ce dont vous avez besoin, en quelques mots." },
  send: { en: "Send the message", fr: "Envoyer le message" },
  sending: { en: "Sending…", fr: "Envoi…" },
  needContact: { en: "Add an email or a phone number so we can answer you.", fr: "Ajoutez un courriel ou un numéro pour qu’on puisse vous répondre." },
  needMessage: { en: "Write a few words about what you need.", fr: "Écrivez quelques mots sur ce dont vous avez besoin." },
  badEmail: { en: "This email doesn’t look right.", fr: "Ce courriel ne semble pas valide." },
  badPhone: { en: "This phone number doesn’t look right.", fr: "Ce numéro ne semble pas valide." },
  limited: { en: "Several messages were just sent from here. Try again in a few minutes.", fr: "Plusieurs messages viennent d’être envoyés d’ici. Réessayez dans quelques minutes." },
  down: { en: "The form can’t be sent right now. Your message is ready in an email instead:", fr: "Le formulaire ne peut pas être envoyé pour le moment. Votre message est prêt dans un courriel :" },
  openEmail: { en: "Open the email", fr: "Ouvrir le courriel" },
  sentTitle: { en: "Message received", fr: "Message reçu" },
  sentBody: { en: "A person from the TAKATAK team reads it and answers you by email or phone.", fr: "Une personne de l’équipe TAKATAK le lit et vous répond par courriel ou par téléphone." },
  reference: { en: "Reference", fr: "Référence" },
  privacy: { en: "Never send a password, a card number or a verification code.", fr: "N’envoyez jamais de mot de passe, de numéro de carte ou de code de vérification." },
} as const satisfies Record<string, Bi>;

/**
 * Message box that reaches a person: the message is recorded in the TAKATAK
 * leads inbox (same intake as the project and hosting forms). When the intake
 * is off or unreachable, the visitor gets the same message ready in an email.
 */
export function ContactForm({
  defaultTopic = "question",
  topics,
  context,
  compact = false,
  messageHint,
  submitLabel,
  onSent,
}: {
  defaultTopic?: ContactTopic;
  /** Limit the subjects offered (for example, partners only). */
  topics?: readonly ContactTopic[];
  /** Extra context added to the message, such as what the visitor was looking at. */
  context?: string | null;
  compact?: boolean;
  /** Placeholder for the message box, when the default one does not fit the page. */
  messageHint?: Bi;
  /** Button text, when "Send the message" does not fit the page. */
  submitLabel?: Bi;
  onSent?: (reference: string) => void;
}) {
  const { user, isAuthenticated } = useAuth();
  const { lang } = useLanguage();
  const c = (v: Bi) => v[lang];
  const sep = lang === "fr" ? " : " : ": ";
  const id = useId();
  const offered = topics ?? (Object.keys(CONTACT_TOPICS) as ContactTopic[]);
  const [topic, setTopic] = useState<ContactTopic>(offered.includes(defaultTopic) ? defaultTopic : offered[0]!);
  const [name, setName] = useState(user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "down">("idle");
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fullMessage = [message.trim(), context ? `— ${context}` : ""].filter(Boolean).join("\n\n");
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`TAKATAK · ${CONTACT_TOPICS[topic][lang]}`)}&body=${encodeURIComponent(
    [fullMessage, name && `${c(COPY.name)}${sep}${name}`, phone && `${c(COPY.phone)}${sep}${phone}`, company && `${c(COPY.company)}${sep}${company}`]
      .filter(Boolean)
      .join("\n"),
  )}`;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (message.trim().length < 3) {
      setError(c(COPY.needMessage));
      return;
    }
    if (!isAuthenticated && !email.trim() && !phone.trim()) {
      setError(c(COPY.needContact));
      return;
    }
    setStatus("sending");
    const result = await submitWebsiteRequest({
      kind: "project_request",
      title: contactTitle(topic, message),
      category: contactCategory(topic),
      message: fullMessage,
      name: name.trim() || undefined,
      email: email.trim() || user?.email || undefined,
      phone: phone.trim() || user?.phone || undefined,
      company: company.trim() || undefined,
      language: lang,
      sourcePage: typeof window !== "undefined" ? window.location.pathname : undefined,
      website,
    });
    if (result.status === "sent") {
      setReference(result.reference);
      setStatus("sent");
      onSent?.(result.reference);
      return;
    }
    if (result.status === "invalid") {
      setStatus("idle");
      const f = result.fieldErrors;
      setError(f.email ? c(COPY.badEmail) : f.phone ? c(COPY.badPhone) : f.contact ? c(COPY.needContact) : c(COPY.needMessage));
      return;
    }
    if (result.status === "rate_limited") {
      setStatus("idle");
      setError(c(COPY.limited));
      return;
    }
    setStatus("down");
  };

  if (status === "sent") {
    return (
      <div role="status" className="rounded-2xl border border-primary/25 bg-primary/10 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 shrink-0 text-primary" size={22} aria-hidden />
          <div>
            <p className="text-base font-semibold text-foreground">{c(COPY.sentTitle)}</p>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{c(COPY.sentBody)}</p>
            {reference && (
              <p className="mt-2 text-xs font-medium text-foreground">
                {c(COPY.reference)}
                {sep}
                {reference}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const field =
    "w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";
  const label = "flex flex-col gap-1.5 text-[13px] font-medium text-foreground";

  return (
    // data-no-pending: the button shows its own "Sending…" state, so the site-wide loading overlay
    // does not freeze the page when the form only shows a validation message.
    <form onSubmit={submit} noValidate data-no-pending className={`grid grid-cols-1 gap-3.5 ${compact ? "" : "sm:grid-cols-2"}`}>
      {offered.length > 1 && (
        <label className={`${label} ${compact ? "" : "sm:col-span-2"}`} htmlFor={`${id}-topic`}>
          {c(COPY.topic)}
          <select id={`${id}-topic`} value={topic} onChange={(e) => setTopic(e.target.value as ContactTopic)} className={field}>
            {offered.map((key) => (
              <option key={key} value={key}>
                {CONTACT_TOPICS[key][lang]}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={`${label} ${compact ? "" : "sm:col-span-2"}`} htmlFor={`${id}-message`}>
        {c(COPY.message)}
        <textarea
          id={`${id}-message`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={compact ? 3 : 5}
          maxLength={3500}
          placeholder={c(messageHint ?? COPY.messageHint)}
          className={`${field} resize-y`}
        />
      </label>
      <label className={label} htmlFor={`${id}-name`}>
        {c(COPY.name)}
        <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} className={field} />
      </label>
      {!compact && (
        <label className={label} htmlFor={`${id}-company`}>
          {c(COPY.company)}
          <input id={`${id}-company`} value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" maxLength={160} className={field} />
        </label>
      )}
      {!isAuthenticated && (
        <>
          <label className={label} htmlFor={`${id}-email`}>
            {c(COPY.email)}
            <input id={`${id}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} className={field} />
          </label>
          <label className={label} htmlFor={`${id}-phone`}>
            {c(COPY.phone)}
            <input id={`${id}-phone`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" maxLength={40} className={field} />
          </label>
        </>
      )}
      {/* Hidden from people; bots that fill it are ignored by the server. */}
      <input
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      {error && (
        <p role="alert" className={`text-sm text-destructive ${compact ? "" : "sm:col-span-2"}`}>
          {error}
        </p>
      )}
      {status === "down" && (
        <div role="alert" className={`rounded-xl border border-border bg-secondary/40 p-3.5 text-sm text-foreground ${compact ? "" : "sm:col-span-2"}`}>
          <p>{c(COPY.down)}</p>
          <a href={mailto} className="mt-2 inline-flex items-center gap-2 font-semibold text-primary underline-offset-4 hover:underline">
            <Mail size={15} aria-hidden /> {c(COPY.openEmail)} ({SUPPORT_EMAIL})
          </a>
        </div>
      )}
      <button
        type="submit"
        disabled={status === "sending"}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 ${compact ? "" : "sm:col-span-2"}`}
      >
        {status === "sending" ? c(COPY.sending) : c(submitLabel ?? COPY.send)} <ArrowRight size={15} aria-hidden />
      </button>
      <p className={`text-[12px] leading-5 text-muted-foreground ${compact ? "" : "sm:col-span-2"}`}>{c(COPY.privacy)}</p>
    </form>
  );
}
