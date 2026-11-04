"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

import { readStoredPlan } from "@/lib/website/home-plan";
import { PLAN_SENT_KEY, planHandoffPayload, planSignature, serviceNames } from "@/lib/website/plan-handoff";
import { submitWebsiteRequest } from "@/lib/website/website-requests";

type Lang = "en" | "fr";

function readLang(): Lang {
  try {
    const stored = window.localStorage.getItem("takatak.lang");
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    /* storage may be unavailable */
  }
  return document.documentElement.lang.startsWith("en") ? "en" : "fr";
}

function readPromo(): string | null {
  try {
    return window.sessionStorage.getItem("takatak:promo");
  } catch {
    return null;
  }
}

/**
 * First dashboard visit after building a plan on takatak.ca: the plan goes to
 * the TAKATAK team once (a Lead in the agency inbox, tied to this account),
 * and the client sees its reference. Nothing is sent when there is no plan,
 * when it was already sent, or when the intake is off (it is kept for later).
 */
export function PlanHandoff() {
  const [sent, setSent] = useState<{ reference: string; names: string[]; lang: Lang } | null>(null);

  useEffect(() => {
    const keys = readStoredPlan();
    if (!keys.length) return;
    const promo = readPromo();
    const signature = planSignature(keys, promo);
    try {
      if (window.localStorage.getItem(PLAN_SENT_KEY) === signature) return;
    } catch {
      return; // without storage we cannot remember it was sent: never risk sending it twice
    }
    const lang = readLang();
    let alive = true;
    void submitWebsiteRequest(planHandoffPayload(keys, promo, lang)).then((result) => {
      if (result.status !== "sent") return;
      try {
        window.localStorage.setItem(PLAN_SENT_KEY, signature);
      } catch {
        /* storage may be unavailable */
      }
      if (alive) setSent({ reference: result.reference, names: serviceNames(keys, lang), lang });
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!sent) return null;
  const fr = sent.lang === "fr";
  return (
    <div role="status" className="fixed bottom-4 right-4 z-50 w-[min(92vw,380px)] rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{fr ? "Votre forfait est envoyé à l’équipe" : "Your plan was sent to the team"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{sent.names.join(", ")}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {fr ? `Référence ${sent.reference}. On vous répond en un jour ouvrable.` : `Reference ${sent.reference}. We reply within one business day.`}
          </p>
        </div>
        <button type="button" onClick={() => setSent(null)} aria-label={fr ? "Fermer" : "Close"} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
