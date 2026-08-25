"use client";

import { Link } from "@/lib/website/nav";
import { ArrowRight, BadgePercent, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import type { OfferServiceChoice } from "./ServiceChoiceStep";

export function OfferSuccessStep({
  choice,
  email,
  reserved,
  signupSearch,
  onClose,
}: {
  choice: OfferServiceChoice;
  email: string;
  reserved: boolean;
  signupSearch: Record<string, string>;
  onClose: () => void;
}) {
  const { t, tx } = useLanguage();
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/15 text-primary animate-scale-in">
          <BadgePercent size={20} />
        </span>
        <h2 className="text-xl font-semibold text-foreground">{t("offer.success.title")}</h2>
      </div>

      <dl className="mt-5 space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">{t("offer.success.service")}</dt>
          <dd className="font-medium text-foreground">{tx(choice.label)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">{t("offer.success.status")}</dt>
          <dd className="inline-flex items-center gap-1.5 font-medium text-foreground">
            {reserved && <CheckCircle2 size={14} className="text-primary" />}
            {t("offer.success.reserved")}
          </dd>
        </div>
        {email && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t("offer.success.email")}</dt>
            <dd className="truncate font-medium text-foreground">{email}</dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">{t("offer.success.next")}</dt>
          <dd className="font-medium text-foreground">{choice.next}</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          to="/register"
          search={signupSearch as never}
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          {t("offer.success.cta")} <ArrowRight size={15} />
        </Link>
        <Link
          to="/pricing"
          onClick={onClose}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
        >
          {t("offer.success.secondary")}
        </Link>
      </div>
    </div>
  );
}