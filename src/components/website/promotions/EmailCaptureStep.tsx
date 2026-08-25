"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import { claimPromoBackend, PROMO_CODE, trackPromo } from "@/lib/website/promotions";

export function EmailCaptureStep({
  onDone,
  onSkip,
}: {
  onDone: (data: { email: string; firstName: string; reserved: boolean }) => void;
  onSkip: () => void;
}) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError(t("offer.email.invalid"));
      return;
    }
    setError(null);
    setBusy(true);
    // Only report success once the promotion layer confirms eligibility.
    const result = await claimPromoBackend(PROMO_CODE);
    const reserved = "promotion" in result || result.state.status !== "used";
    trackPromo("signup_promo_claimed", { surface: "welcome_flow" });
    setBusy(false);
    onDone({ email: email.trim(), firstName: firstName.trim(), reserved });
  }

  return (
    <form onSubmit={submit}>
      <h2 className="text-xl font-semibold text-foreground">{t("offer.email.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("offer.email.body")}</p>
      <div className="mt-5 space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t("offer.email.email")}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/60"
            placeholder={t("promo.invite.placeholder")}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t("offer.email.name")}</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/60"
          />
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <p className="mt-3 text-xs text-muted-foreground">{t("offer.email.privacy")}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          {busy ? t("offer.email.working") : t("offer.email.cta")}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
        >
          {t("offer.email.skip")}
        </button>
      </div>
    </form>
  );
}