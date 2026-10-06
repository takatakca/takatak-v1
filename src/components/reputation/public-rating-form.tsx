"use client";

import { useActionState, useState } from "react";

import { submitRatingAction, type RatingFormState } from "@/app/r/[slug]/actions";

const initialState: RatingFormState = { status: "idle" };

const LABELS = ["", "Très déçu · Very poor", "Déçu · Poor", "Correct · Okay", "Bien · Good", "Excellent !"];

export function PublicRatingForm({
  slug,
  token,
  profileName,
  recipientName,
}: {
  slug: string;
  token: string | null;
  profileName: string;
  recipientName: string | null;
}) {
  const [state, formAction, pending] = useActionState(submitRatingAction, initialState);
  const [rating, setRating] = useState(0);
  const [wantsContact, setWantsContact] = useState(false);

  if (state.status === "done") {
    const goHref = (to: "google" | "facebook") => `/r/${slug}/go?to=${to}&r=${encodeURIComponent(state.responseId)}`;
    const happy = state.rating >= 4;
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-bold text-slate-950">Merci{recipientName ? `, ${recipientName}` : ""} ! 🙏</h1>
        <p className="text-sm text-slate-600">
          {happy
            ? "Votre avis public aiderait énormément une entreprise locale."
            : "Merci de votre franchise. L’équipe lira votre message personnellement."}
        </p>
        <p className="text-xs text-slate-400">
          {happy
            ? "A public review would really help a local business."
            : "Thank you for being honest. The team will read your message personally."}
        </p>
        {state.thankYouMessage ? <p className="text-sm italic text-slate-700">“{state.thankYouMessage}”</p> : null}
        <div className="flex flex-col gap-2 pt-2">
          {state.hasGoogle ? (
            <a href={goHref("google")} data-no-pending="true" className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700">
              Publier sur Google · Post on Google
            </a>
          ) : null}
          {state.hasFacebook ? (
            <a href={goHref("facebook")} data-no-pending="true" className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 hover:border-indigo-400">
              Recommander sur Facebook · Recommend on Facebook
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />
      {token ? <input type="hidden" name="t" value={token} /> : null}
      <input type="hidden" name="rating" value={rating || ""} />
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">{profileName}</p>
        <h1 className="mt-2 text-xl font-bold text-slate-950">
          {recipientName ? `${recipientName}, comment` : "Comment"} était votre expérience ?
        </h1>
        <p className="text-xs text-slate-400">How was your experience?</p>
      </div>

      <fieldset>
        <legend className="sr-only">Note de 1 à 5 · Rating from 1 to 5</legend>
        <div className="flex justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`${n} / 5`}
              aria-pressed={rating === n}
              className={`h-12 w-12 rounded-xl text-3xl leading-none transition ${n <= rating ? "text-amber-400" : "text-slate-200 hover:text-amber-200"}`}
            >
              ★
            </button>
          ))}
        </div>
        <p className="mt-1 h-4 text-center text-xs text-slate-500">{LABELS[rating]}</p>
      </fieldset>

      {rating > 0 ? (
        <div className="space-y-3">
          <label className="block space-y-1 text-xs font-medium text-slate-700">
            {rating >= 4 ? "Un mot à ajouter ? (facultatif) · Anything to add? (optional)" : "Que pouvons-nous améliorer ? · What could we do better?"}
            <textarea
              name="feedback"
              rows={4}
              maxLength={2000}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          {rating >= 4 ? (
            <label className="flex items-start gap-2 text-xs text-slate-600">
              <input type="checkbox" name="publishConsent" className="mt-0.5" />
              <span>
                J’accepte que mon commentaire et mon prénom soient affichés sur le site de l’entreprise.
                <br />
                <span className="text-slate-400">I agree my comment and first name may be shown on the business’s website.</span>
              </span>
            </label>
          ) : null}

          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              name="followUpConsent"
              checked={wantsContact}
              onChange={(e) => setWantsContact(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              J’accepte d’être recontacté au sujet de mon avis.
              <br />
              <span className="text-slate-400">I agree to be contacted about my feedback.</span>
            </span>
          </label>

          {wantsContact ? (
            <div className="grid gap-2">
              <input name="contactName" placeholder="Nom · Name" maxLength={80} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              <input name="contactEmail" type="email" placeholder="Courriel · Email" maxLength={254} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              <input name="contactPhone" type="tel" placeholder="Téléphone · Phone" maxLength={32} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </div>
          ) : null}
        </div>
      ) : null}

      {state.status === "error" ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!rating || pending}
        className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Envoi… · Sending…" : "Envoyer · Send"}
      </button>
      <p className="text-center text-[10px] leading-4 text-slate-400">
        Vos coordonnées ne sont conservées que si vous acceptez d’être recontacté. · Contact details are kept only if you ask to be contacted.
      </p>
    </form>
  );
}
