"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, CheckCircle2, ShieldCheck } from "lucide-react";
import { IoArrowBack } from "react-icons/io5";

import { CheckoutScrollArrow } from "@/components/website/checkout/checkout-scroll-arrow";
import { DomainSearchDesk } from "@/components/website/domain/domain-search-desk";
import { UpmindHostingPlans } from "@/components/website/hosting/upmind-hosting-plans";
import {
  clearCheckoutSelection,
  readCheckoutSelection,
  type CheckoutSelection,
} from "@/lib/website/marketplace-storage";
import { categoryName, packageTitle, tierName } from "@/lib/website/marketplace-i18n";
import { useLanguage } from "@/lib/website/use-language";
import { submitWebsiteRequest } from "@/lib/website/website-requests";
import styles from "./checkout-domain.module.css";

type Lang = "en" | "fr";

/** "1 499,00 $" in French, "$1,499.00" in English. */
function dollars(cents: number, lang: Lang): string {
  const n = (cents / 100).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return lang === "fr" ? `${n} $` : `$${n}`;
}

const COPY = {
  limited: { en: "Too many requests were sent. Please wait a few minutes and try again.", fr: "Trop de demandes ont été envoyées. Attendez quelques minutes et réessayez." },
  gone: { en: "This package is no longer available as selected. Please choose it again from the marketplace.", fr: "Ce forfait n’est plus offert tel que choisi. Choisissez-le de nouveau dans la Marketplace." },
  down: { en: "We couldn't send your order right now. Your selection is kept — please try again shortly or email support@takatak.ca.", fr: "Votre commande n’a pas pu être envoyée pour le moment. Votre choix est gardé : réessayez sous peu ou écrivez à support@takatak.ca." },
  received: { en: "Order received", fr: "Commande reçue" },
  receivedBody: {
    en: "TAKATAK received your order for “{title}” ({tier}). A specialist will confirm the scope and send your invoice. Nothing is charged until you approve it.",
    fr: "TAKATAK a reçu votre commande « {title} » ({tier}). Un spécialiste confirme le contenu et vous envoie la facture. Rien n’est facturé avant votre approbation.",
  },
  reference: { en: "Reference: {ref}", fr: "Référence : {ref}" },
  quoted: { en: " · Quoted total {total} CAD", fr: " · Total soumis {total} CAD" },
  back: { en: "Back to marketplace", fr: "Retour à la Marketplace" },
  dashboard: { en: "Go to my dashboard", fr: "Aller à mon tableau de bord" },
  title: { en: "Review your TAKATAK order", fr: "Vérifiez votre commande TAKATAK" },
  lead: { en: "Confirm the selected package and send it to TAKATAK. A specialist confirms the scope before anything is charged.", fr: "Confirmez le forfait choisi et envoyez-le à TAKATAK. Un spécialiste confirme le contenu avant toute facturation." },
  summary: { en: "TAKATAK order summary", fr: "Résumé de la commande TAKATAK" },
  tierLine: { en: "{tier} tier · {days}-day delivery", fr: "Forfait {tier} · livraison en {days} jours" },
  tierLineOne: { en: "{tier} tier · 1-day delivery", fr: "Forfait {tier} · livraison en 1 jour" },
  pkg: { en: "Package", fr: "Forfait" },
  discount: { en: "{code} discount", fr: "Rabais {code}" },
  total: { en: "Total", fr: "Total" },
  sending: { en: "Sending…", fr: "Envoi…" },
  send: { en: "Send order to TAKATAK", fr: "Envoyer la commande à TAKATAK" },
  noPay: { en: "No payment is taken now. Final price is confirmed on your invoice.", fr: "Aucun paiement maintenant. Le prix final est confirmé sur votre facture." },
  remove: { en: "Remove package", fr: "Retirer le forfait" },
  goBack: { en: "Back", fr: "Retour" },
  journey: { en: "Checkout: Get Started With Your Domain & Hosting Journey", fr: "Commande : votre domaine et votre hébergement" },
  domainTitle: { en: "Power Your Online Success", fr: "Lancez votre présence en ligne" },
  domainTitle2: { en: "with the Perfect Domain.", fr: "avec le bon domaine." },
  upmindNote: { en: "Search works. If Upmind asks you to create an account, refresh this page so TAKATAK can attach your customer.", fr: "La recherche fonctionne. Si Upmind vous demande de créer un compte, actualisez cette page pour que TAKATAK relie votre dossier client." },
  hostingTitle: { en: "Pick a plan and", fr: "Choisissez un forfait et" },
  hostingTitle2: { en: " supercharge your WordPress.", fr: " propulsez votre WordPress." },
  hostingLead: { en: "Order your go-to setup, or explore a bold new option. Our TAKATAK WordPress hosting plans are built to match any project — including yours.", fr: "Commandez la configuration qui vous convient, ou essayez une nouvelle option. Les forfaits d’hébergement WordPress TAKATAK s’adaptent à tous les projets, y compris le vôtre." },
} as const;

function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

function MarketplaceOrder({
  selection,
  onClear,
  onSent,
}: {
  selection: CheckoutSelection;
  onClear: () => void;
  onSent: () => void;
}) {
  const { lang } = useLanguage();
  const c = (v: { en: string; fr: string }) => v[lang];
  const title = packageTitle({ id: selection.packageId, title: selection.title }, lang);
  const tier = tierName(selection.tierName, lang);
  const [sending, setSending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [confirmedTotal, setConfirmedTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendOrder() {
    setSending(true);
    setError(null);
    const result = await submitWebsiteRequest({
      kind: "package_order",
      packageId: selection.packageId,
      tierName: selection.tierName,
      addons: selection.addons.map((item) => item.label),
      promoCode: selection.promoCode ?? undefined,
      language: lang,
      sourcePage: "/checkout",
    });
    setSending(false);
    if (result.status === "sent") {
      setReference(result.reference);
      setConfirmedTotal(result.totalCents ?? selection.finalTotalCents);
      onSent();
      return;
    }
    if (result.status === "rate_limited") {
      setError(c(COPY.limited));
      return;
    }
    if (result.status === "invalid") {
      setError(c(COPY.gone));
      return;
    }
    setError(c(COPY.down));
  }

  if (reference) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-8">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={24} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-slate-950">{c(COPY.received)}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-700">{fill(c(COPY.receivedBody), { title, tier })}</p>
              <p className="mt-3 text-sm font-medium text-slate-900">
                {fill(c(COPY.reference), { ref: reference })}
                {confirmedTotal !== null ? fill(c(COPY.quoted), { total: dollars(confirmedTotal, lang) }) : null}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/marketplace" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">
                  {c(COPY.back)}
                </Link>
                <Link href="/dashboard" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800">
                  {c(COPY.dashboard)}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold text-slate-950 md:text-4xl">{c(COPY.title)}</h1>
        <p className="mt-2 text-slate-600">{c(COPY.lead)}</p>
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between bg-[#090a1a] px-6 py-4 text-white">
            <span className="inline-flex items-center gap-2 font-semibold">
              <ShieldCheck size={17} className="text-sky-400" />
              {c(COPY.summary)}
            </span>
            <span className="text-xs text-slate-400">CAD</span>
          </div>
          <div className="p-6">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              {categoryName(selection.category, selection.category.replace(/_/g, " "), lang)}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {fill(c(selection.deliveryDays <= 1 ? COPY.tierLineOne : COPY.tierLine), { tier, days: selection.deliveryDays })}
            </p>
            <div className="mt-6 space-y-3 border-y border-slate-200 py-5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">{c(COPY.pkg)}</span>
                <span className="font-medium text-slate-950">
                  {dollars(selection.tierPriceCents, lang)}
                </span>
              </div>
              {selection.addons.map((item) => (
                <div key={item.label} className="flex justify-between">
                  <span className="inline-flex items-center gap-2 text-slate-600">
                    <Check size={13} className="text-primary" />
                    {item.label}
                  </span>
                  <span className="font-medium text-slate-950">
                    {dollars(item.priceCents, lang)}
                  </span>
                </div>
              ))}
              {selection.discountCents > 0 ? (
                <div className="flex justify-between text-primary">
                  <span>{fill(c(COPY.discount), { code: selection.promoCode ?? "" }).replace(/\s+/g, " ").trim()}</span>
                  <span>-{dollars(selection.discountCents, lang)}</span>
                </div>
              ) : null}
            </div>
            <div className="mt-5 flex items-end justify-between">
              <span className="font-medium text-slate-700">{c(COPY.total)}</span>
              <span className="text-3xl font-bold text-slate-950">
                {dollars(selection.finalTotalCents, lang)}
              </span>
            </div>
            {error ? (
              <p role="alert" className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={sendOrder}
              disabled={sending}
              className="mt-6 inline-flex w-full justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {sending ? c(COPY.sending) : c(COPY.send)}
            </button>
            <p className="mt-2 text-center text-xs text-slate-500">{c(COPY.noPay)}</p>
            <button
              type="button"
              onClick={onClear}
              className="mt-2 w-full rounded-lg border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              {c(COPY.remove)}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CheckoutClient({
  upmindClientId = null,
}: {
  upmindClientId?: string | null;
}) {
  const router = useRouter();
  const { lang } = useLanguage();
  const c = (v: { en: string; fr: string }) => v[lang];
  const [selection, setSelection] = useState<CheckoutSelection | null>(
    null,
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSelection(readCheckoutSelection());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  if (selection) {
    return (
      <MarketplaceOrder
        selection={selection}
        onClear={() => {
          clearCheckoutSelection();
          setSelection(null);
        }}
        onSent={() => clearCheckoutSelection()}
      />
    );
  }

  return (
    <div>
      <div
        className={`flex items-center gap-[30px] bg-white text-black ${styles.pagetop}`}
      >
        <button
          type="button"
          className={`flex items-center gap-[10px] rounded bg-[#dfdfeb] ${styles.butn}`}
          onClick={() => {
            if (window.history.length > 1) {
              router.back();
              return;
            }
            router.push("/domain");
          }}
        >
          <IoArrowBack />
          {c(COPY.goBack)}
        </button>
        <p className="font-semibold">{c(COPY.journey)}</p>
      </div>

      <section className="flex flex-col items-center justify-center bg-[#090a1a] py-[70px]">
        <div className="flex flex-col items-center justify-center gap-[40px] text-white">
          <h1 className="w-[90vw] text-center text-[30px] font-[700] lg:w-[45vw] lg:text-[34px]">
            {c(COPY.domainTitle)}{" "}
            <span className="font-medium">{c(COPY.domainTitle2)}</span>
          </h1>
        </div>
        <div className="w-full">
          <DomainSearchDesk clientId={upmindClientId} />
        </div>
        {!upmindClientId ? (
          <p className="mt-4 px-6 text-center text-xs text-white/70">
            {c(COPY.upmindNote)}
          </p>
        ) : null}
      </section>

      <section
        id="checkout-hosting"
        className="flex scroll-mt-24 flex-col items-center justify-center gap-[30px] bg-white px-6 py-[70px] text-black"
      >
        <div className="flex flex-col items-center gap-[15px]">
          <h2 className="text-center text-[33px]">
            {c(COPY.hostingTitle)}
            <span className="font-bold">{c(COPY.hostingTitle2)}</span>
          </h2>
          <p className="w-[85vw] text-center text-[19px] font-semibold lg:w-[49vw]">
            {c(COPY.hostingLead)}
          </p>
        </div>
        <div className="w-full max-w-6xl">
          <UpmindHostingPlans clientId={upmindClientId} />
        </div>
      </section>

      <CheckoutScrollArrow downTargetId="checkout-hosting" />
    </div>
  );
}
