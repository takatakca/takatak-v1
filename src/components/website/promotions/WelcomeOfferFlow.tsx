"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { LanguageChoiceStep } from "./LanguageChoiceStep";
import { EmailCaptureStep } from "./EmailCaptureStep";
import { ServiceChoiceStep, type OfferServiceChoice } from "./ServiceChoiceStep";
import { OfferSuccessStep } from "./OfferSuccessStep";
import { useLanguage } from "@/lib/website/use-language";
import { PROMO_CODE, trackPromo } from "@/lib/website/promotions";
import { readDomainQuery } from "@/lib/website/domain-search-state";

const LANG_CHOSEN_KEY = "takatak.lang.chosen";

/**
 * Guided TAKATAK welcome-offer flow: language → email → starting point →
 * success + signup handoff. All context (email, service, language, domain
 * query, return path) is preserved into /signup.
 */
export function WelcomeOfferFlow({ onClose }: { onClose: () => void }) {
  const { t, lang, setLang } = useLanguage();
  const panelRef = useRef<HTMLDivElement>(null);
  const langAlreadyChosen =
    typeof window !== "undefined" && window.localStorage.getItem(LANG_CHOSEN_KEY) === "1";
  const [step, setStep] = useState(langAlreadyChosen ? 2 : 1);
  const [email, setEmail] = useState("");
  const [reserved, setReserved] = useState(false);
  const [choice, setChoice] = useState<OfferServiceChoice | null>(null);

  useEffect(() => {
    trackPromo("signup_promo_viewed", { surface: "welcome_flow" });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const domainQuery = typeof window !== "undefined" ? readDomainQuery() : null;
  const signupSearch: Record<string, string> = {
    promo: PROMO_CODE,
    lang,
    ...(email ? { email } : {}),
    ...(choice ? { service: choice.key, next: choice.next } : {}),
    ...(domainQuery ? { domain: domainQuery.domain } : {}),
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t("offer.email.title")}
        className="relative w-full max-w-xl max-h-[92dvh] overflow-y-auto rounded-t-2xl border border-border bg-popover p-5 shadow-2xl outline-none animate-scale-in sm:rounded-2xl sm:p-7"
      >
        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            {t("offer.progress", { step })}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("offer.close")}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-secondary" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        <div className="mt-5">
          {step === 1 && (
            <LanguageChoiceStep
              onSelect={(next) => {
                setLang(next);
                try { window.localStorage.setItem(LANG_CHOSEN_KEY, "1"); } catch { /* ignore */ }
                setStep(2);
              }}
            />
          )}
          {step === 2 && (
            <EmailCaptureStep
              onDone={({ email: value, reserved: ok }) => { setEmail(value); setReserved(ok); setStep(3); }}
              onSkip={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <ServiceChoiceStep onSelect={(c) => { setChoice(c); setStep(4); }} />
          )}
          {step === 4 && choice && (
            <OfferSuccessStep
              choice={choice}
              email={email}
              reserved={reserved}
              signupSearch={signupSearch}
              onClose={onClose}
            />
          )}
        </div>

        {step > 1 && step < 4 && (
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="mt-5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {t("offer.back")}
          </button>
        )}
      </div>
    </div>
  );
}