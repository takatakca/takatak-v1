"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";

import { useCopy } from "@/components/website/premium/ui";
import { Link } from "@/lib/website/nav";

type Mode = "confirm" | "unsubscribe";

const t = {
  confirm: {
    title: { fr: "Confirmer votre inscription", en: "Confirm your subscription" },
    body: {
      fr: "Un clic, et vous recevrez l'infolettre de Groupe TAKATAK. Le lien de désabonnement est dans chaque courriel.",
      en: "One click and you will receive the Groupe TAKATAK newsletter. The unsubscribe link is in every email.",
    },
    action: { fr: "Confirmer", en: "Confirm" },
    done: { fr: "C'est confirmé. Merci !", en: "Confirmed. Thank you!" },
    doneBody: {
      fr: "Vous recevrez nos prochaines offres et leçons. Vous pouvez vous désabonner en tout temps.",
      en: "You will get our next offers and lessons. You can unsubscribe at any time.",
    },
  },
  unsubscribe: {
    title: { fr: "Se désabonner de l'infolettre", en: "Unsubscribe from the newsletter" },
    body: {
      fr: "Vous ne recevrez plus l'infolettre de Groupe TAKATAK. Cela prend effet tout de suite.",
      en: "You will no longer receive the Groupe TAKATAK newsletter. It takes effect right away.",
    },
    action: { fr: "Me désabonner", en: "Unsubscribe me" },
    done: { fr: "C'est fait : vous êtes désabonné.", en: "Done: you are unsubscribed." },
    doneBody: {
      fr: "Aucun autre courriel de l'infolettre ne vous sera envoyé. Vous pouvez vous réinscrire quand vous voulez.",
      en: "No more newsletter emails will be sent to you. You can subscribe again whenever you like.",
    },
  },
  bad: {
    fr: "Ce lien n'est pas valide ou a été modifié. Ouvrez le lien du courriel tel quel, ou écrivez à support@takatak.ca.",
    en: "This link is not valid or was altered. Open the link from the email as is, or write to support@takatak.ca.",
  },
  failed: { fr: "Ça n'a pas fonctionné. Réessayez dans un moment.", en: "That did not work. Try again in a moment." },
  home: { fr: "Retour à takatak.ca", en: "Back to takatak.ca" },
};

/** Confirm or unsubscribe from an email link. Acts only on a click (mail scanners open links). */
export function NewsletterLink({ mode }: { mode: Mode }) {
  const { lang } = useCopy();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [state, setState] = useState<"idle" | "sending" | "done" | "bad" | "failed">("idle");
  const copy = t[mode];

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("t"));
  }, []);

  async function act() {
    if (!token) return;
    setState("sending");
    try {
      const res = await fetch(`/api/public/newsletter/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) return setState("done");
      setState(res.status === 400 || res.status === 404 ? "bad" : "failed");
    } catch {
      setState("failed");
    }
  }

  const invalid = token === null || state === "bad";

  return (
    <section className="hp-bg flex min-h-[70vh] items-center px-4 py-24">
      <div className="hp-card hp-ink mx-auto w-full max-w-xl rounded-[32px] p-8 shadow-[var(--hp-shadow)] sm:p-12">
        {state === "done" ? (
          <>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--hp-cta)] text-white">
              <Check size={22} strokeWidth={3} aria-hidden />
            </span>
            <h1 className="hp-display mt-6 text-[34px] sm:text-[40px]" role="status">{copy.done[lang]}</h1>
            <p className="hp-ink-2 mt-4 text-[16px] leading-7">{copy.doneBody[lang]}</p>
          </>
        ) : (
          <>
            <h1 className="hp-display text-[34px] sm:text-[40px]">{copy.title[lang]}</h1>
            <p className="hp-ink-2 mt-4 text-[16px] leading-7">{invalid ? t.bad[lang] : copy.body[lang]}</p>
            {!invalid && (
              <button
                type="button"
                onClick={act}
                disabled={!token || state === "sending"}
                className="hp-cta mt-8 inline-flex items-center gap-2 rounded-full px-7 py-4 text-[16px] font-semibold disabled:opacity-50"
              >
                {state === "sending" && <Loader2 size={16} className="animate-spin" aria-hidden />}
                {copy.action[lang]}
              </button>
            )}
            {state === "failed" && <p role="alert" className="hp-warn mt-4 text-[14px] font-medium">{t.failed[lang]}</p>}
          </>
        )}
        <p className="mt-10">
          <Link to="/" className="hp-ink-2 inline-flex items-center gap-2 text-[14px] font-semibold hover:text-[var(--hp-ink)]">
            {t.home[lang]} <ArrowRight size={14} aria-hidden />
          </Link>
        </p>
      </div>
    </section>
  );
}
