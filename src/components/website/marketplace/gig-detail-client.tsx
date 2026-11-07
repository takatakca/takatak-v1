"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useState,
} from "react";
import {
  Check,
  Clock,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { ServiceThumbnail } from "@/components/website/marketplace/ServiceThumbnail";
import type { MarketplacePackage } from "@/lib/website/marketplace-catalog";
import {
  saveCheckoutSelection,
  saveQuotePrefill,
} from "@/lib/website/marketplace-storage";
import {
  categoryName,
  fastestDelivery,
  formatCad,
  packageTitle,
  startingPrice,
  tierName,
} from "@/lib/website/marketplace-i18n";
import { previewPromoBackend } from "@/lib/website/promotions";
import { useLanguage } from "@/lib/website/use-language";

const COPY = {
  back: { fr: "← Retour à la place de marché", en: "← Back to marketplace" },
  delivered: { fr: "Livré par TAKATAK", en: "Delivered through TAKATAK" },
  whatYouGet: { fr: "Ce que vous obtenez", en: "What you get" },
  protection: { fr: "Protection TAKATAK", en: "TAKATAK protection" },
  protectionBody: {
    fr: "La portée du projet, les fichiers, les étapes, les révisions et les approbations restent organisés par TAKATAK.",
    en: "The project scope, files, milestones, revisions, and approvals remain organized through TAKATAK.",
  },
  about: { fr: "À propos de ce forfait", en: "About this package" },
  catalogNote: {
    fr: "Le détail du forfait est pour l’instant en anglais.",
    en: "",
  },
  days: { fr: "{n} jours", en: "{n} days" },
  revisions: { fr: "{n} révisions", en: "{n} revisions" },
  addons: { fr: "Options et ajouts", en: "Add-ons and upgrades" },
  addonsLead: { fr: "Extras facultatifs à ajouter à ce forfait.", en: "Optional extras you can add to this package." },
  faq: { fr: "Questions fréquentes", en: "Frequently asked questions" },
  related: { fr: "Forfaits semblables", en: "Related packages" },
  order: { fr: "Commande TAKATAK", en: "TAKATAK order" },
  currency: { fr: "$ CA", en: "CAD" },
  selectedTier: { fr: "Formule choisie · {t}", en: "Selected tier · {t}" },
  intake: {
    fr: "Questionnaire requis : TAKATAK recueille un brief avant de commencer le projet.",
    en: "Intake required — TAKATAK will collect a project brief before kickoff.",
  },
  promo: { fr: "Code promo", en: "Promotion code" },
  apply: { fr: "Appliquer", en: "Apply" },
  applied: { fr: "Rabais de {p} % appliqué : −{a}", en: "{p}% discount applied: −{a}" },
  serverNote: {
    fr: "Le rabais final est calculé par nos serveurs à la commande.",
    en: "The final discount is calculated by our servers when you order.",
  },
  continue: { fr: "Continuer ({a})", en: "Continue ({a})" },
  quote: { fr: "Demander une soumission sur mesure", en: "Request a custom quote" },
  saved: {
    fr: "Votre sélection est gardée avant de passer au compte TAKATAK sécurisé.",
    en: "Your selection is saved before continuing to the secure TAKATAK account flow.",
  },
  side1: { fr: "TAKATAK organise le démarrage et la livraison du projet.", en: "TAKATAK organizes the project kickoff and delivery." },
  side2: { fr: "Les fichiers et les messages restent dans l’espace du projet.", en: "Files and messages remain inside the project workspace." },
  side3: { fr: "Les révisions restent liées au projet en cours.", en: "Revisions remain connected to the active project." },
} as const;

const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));

export function GigDetailClient({
  pkg,
  related,
}: {
  pkg: MarketplacePackage;
  related: MarketplacePackage[];
}) {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const dollars = (cents: number) => formatCad(cents, lang);

  const [tierIndex, setTierIndex] =
    useState(
      pkg.tiers.length > 1
        ? 1
        : 0,
    );

  const [
    selectedAddons,
    setSelectedAddons,
  ] = useState<number[]>([]);

  const [promoCode, setPromoCode] =
    useState("");

  // The server's preview gives the real discount; keep its rate so it follows tier and add-on changes.
  const [appliedPromo, setAppliedPromo] =
    useState<{ code: string; rate: number } | null>(null);

  const [promoNote, setPromoNote] =
    useState<string | null>(null);

  const tier =
    pkg.tiers[tierIndex];

  const addons =
    selectedAddons.map(
      (index) =>
        pkg.addons[index],
    );

  const addonsTotal =
    addons.reduce(
      (sum, item) =>
        sum + item.priceCents,
      0,
    );

  const subtotal =
    tier.priceCents +
    addonsTotal;

  const discount =
    appliedPromo
      ? Math.round(
          subtotal * appliedPromo.rate,
        )
      : 0;

  const total =
    subtotal - discount;

  function toggleAddon(
    index: number,
  ) {
    setSelectedAddons(
      (current) =>
        current.includes(index)
          ? current.filter(
              (item) =>
                item !== index,
            )
          : [...current, index],
    );
  }

  function createPrefill() {
    return {
      packageId: pkg.id,
      title: pkg.title,
      category: pkg.category,
      tierName: tier.name,
      tierPriceCents:
        tier.priceCents,
      addons: addons.map(
        (item) => ({
          label: item.label,
          priceCents:
            item.priceCents,
        }),
      ),
      totalCents: subtotal,
    };
  }

  function continueCheckout() {
    saveCheckoutSelection({
      ...createPrefill(),
      deliveryDays:
        tier.deliveryDays,
      promoCode:
        appliedPromo
          ? appliedPromo.code
          : null,
      discountCents:
        discount,
      finalTotalCents: total,
    });

    router.push("/checkout");
  }

  function requestQuote() {
    saveQuotePrefill(
      createPrefill(),
    );

    router.push(
      "/marketplace/post-project",
    );
  }

  async function applyPromo() {
    const code = promoCode.trim();
    if (!code) {
      setAppliedPromo(null);
      setPromoNote(null);
      return;
    }
    const preview = await previewPromoBackend({
      code,
      subtotalCents: subtotal,
    });
    if (preview && preview.discountCents > 0 && preview.subtotalCents > 0) {
      setAppliedPromo({
        code: (preview.code || code).toUpperCase(),
        rate: preview.discountCents / preview.subtotalCents,
      });
      setPromoNote(null);
      return;
    }
    setAppliedPromo(null);
    setPromoNote(preview ? t("promo.code.rejected") : t("promo.code.unavailable"));
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link
        href="/marketplace"
        className="text-xs text-slate-500 transition hover:text-slate-950"
      >
        {COPY.back[lang]}
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <header>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {categoryName(pkg.category, pkg.categoryName, lang)}
            </p>

            <h1 className="mt-1 text-3xl font-bold leading-tight text-slate-950 md:text-4xl">
              {packageTitle(pkg, lang)}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>
                {COPY.delivered[lang]}
              </span>
            </div>
          </header>

          <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
            <ServiceThumbnail
              kind={pkg.thumb}
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              pkg.thumb,
              "branding",
              "seo",
              "social",
            ].map((kind, index) => (
              <div
                key={`${kind}-${index}`}
                className={`overflow-hidden rounded-lg border ${
                  index === 0
                    ? "border-primary ring-1 ring-primary/25"
                    : "border-slate-200"
                }`}
              >
                <ServiceThumbnail
                  kind={
                    kind as MarketplacePackage["thumb"]
                  }
                />
              </div>
            ))}
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-950">
              {COPY.whatYouGet[lang]}
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pkg.deliverables.map(
                (item) => (
                  <div
                    key={item}
                    className="flex items-start gap-2 text-sm text-slate-700"
                  >
                    <Check
                      size={14}
                      className="mt-1 shrink-0 text-primary"
                    />

                    {item}
                  </div>
                ),
              )}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-[#090a1a] p-5 text-white">
            <div className="flex items-start gap-3">
              <ShieldCheck
                size={20}
                className="mt-0.5 shrink-0 text-sky-400"
              />

              <div>
                <h2 className="font-semibold">
                  {COPY.protection[lang]}
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-300">
                  {COPY.protectionBody[lang]}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-950">
              {COPY.about[lang]}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {pkg.description}
            </p>

            {lang === "fr" ? (
              <p className="mt-2 text-xs text-slate-500">
                {COPY.catalogNote.fr}
              </p>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="grid grid-cols-3 border-b border-slate-200">
              {pkg.tiers.map(
                (tierItem, index) => (
                  <button
                    key={tierItem.name}
                    type="button"
                    onClick={() =>
                      setTierIndex(index)
                    }
                    className={`px-4 py-3 text-sm font-semibold ${
                      index === tierIndex
                        ? "border-b-2 border-primary bg-primary/5 text-primary"
                        : "text-slate-500 hover:text-slate-950"
                    }`}
                  >
                    {tierName(tierItem.name, lang)}
                  </button>
                ),
              )}
            </div>

            <div className="p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="text-2xl font-bold text-slate-950">
                  {dollars(
                    tier.priceCents,
                  )}
                </p>

                <div className="flex gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} />
                    {fill(COPY.days[lang], { n: tier.deliveryDays })}
                  </span>

                  <span className="inline-flex items-center gap-1">
                    <RefreshCw size={12} />
                    {fill(COPY.revisions[lang], { n: tier.revisions })}
                  </span>
                </div>
              </div>

              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {tier.includes.map(
                  (item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2"
                    >
                      <Check
                        size={14}
                        className="mt-1 shrink-0 text-primary"
                      />

                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-950">
              {COPY.addons[lang]}
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {COPY.addonsLead[lang]}
            </p>

            <ul className="mt-4 space-y-2">
              {pkg.addons.map(
                (item, index) => {
                  const selected =
                    selectedAddons.includes(
                      index,
                    );

                  return (
                    <li key={item.label}>
                      <button
                        type="button"
                        onClick={() =>
                          toggleAddon(
                            index,
                          )
                        }
                        className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded border ${
                              selected
                                ? "border-primary bg-primary text-white"
                                : "border-slate-300"
                            }`}
                          >
                            {selected ? (
                              <Check size={11} />
                            ) : null}
                          </span>

                          <span className="font-medium text-slate-950">
                            {item.label}
                          </span>
                        </span>

                        <span className="font-semibold text-slate-950">
                          +
                          {dollars(
                            item.priceCents,
                          )}
                        </span>
                      </button>
                    </li>
                  );
                },
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-950">
              {COPY.faq[lang]}
            </h2>

            <ul className="mt-3 divide-y divide-slate-200">
              {pkg.faq.map((item) => (
                <li
                  key={item.q}
                  className="py-3"
                >
                  <p className="text-sm font-medium text-slate-950">
                    {item.q}
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {item.a}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {related.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="font-semibold text-slate-950">
                {COPY.related[lang]}
              </h2>

              <ul className="mt-3 divide-y divide-slate-200">
                {related.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/marketplace/gigs/${item.id}`}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-950">
                          {packageTitle(item, lang)}
                        </p>

                        <p className="truncate text-xs text-slate-500">
                          {categoryName(item.category, item.categoryName, lang)} ·{" "}
                          {fastestDelivery(item, lang)}
                        </p>
                      </div>

                      <span className="shrink-0 text-sm font-semibold text-slate-950">
                        {startingPrice(item, lang)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="h-fit space-y-3 lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between bg-[#090a1a] px-6 py-3 text-xs font-semibold text-white">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck
                  size={13}
                  className="text-sky-400"
                />

                {COPY.order[lang]}
              </span>

              <span className="text-slate-400">
                {COPY.currency[lang]}
              </span>
            </div>

            <div className="p-6">
              <p className="text-xs text-slate-500">
                {fill(COPY.selectedTier[lang], { t: tierName(tier.name, lang) })}
              </p>

              <p className="mt-1 text-3xl font-bold text-slate-950">
                {dollars(total)}
              </p>

              {pkg.intakeRequired ? (
                <div className="mt-3 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-[11px] text-primary">
                  {COPY.intake[lang]}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-3 border-y border-slate-200 py-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} />
                  {fill(COPY.days[lang], { n: tier.deliveryDays })}
                </span>

                <span>·</span>
                <span>
                  {fill(COPY.revisions[lang], { n: tier.revisions })}
                </span>
              </div>

              <div className="mt-4">
                <label htmlFor="gig-promo" className="block text-xs font-medium text-slate-700">
                  {COPY.promo[lang]}
                </label>

                <div className="mt-1 flex gap-2">
                  <input
                    id="gig-promo"
                    value={promoCode}
                    onChange={(event) => {
                      setPromoCode(
                        event.target.value,
                      );

                      setAppliedPromo(null);
                      setPromoNote(null);
                    }}
                    placeholder="FIRST10"
                    className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                  />

                  <button
                    type="button"
                    onClick={applyPromo}
                    className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    {COPY.apply[lang]}
                  </button>
                </div>

                {appliedPromo ? (
                  <p className="mt-2 text-xs text-primary">
                    {fill(COPY.applied[lang], {
                      p: Math.round(appliedPromo.rate * 100),
                      a: dollars(discount),
                    })}
                    <span className="mt-0.5 block text-slate-500">
                      {COPY.serverNote[lang]}
                    </span>
                  </p>
                ) : promoNote ? (
                  <p className="mt-2 text-xs text-destructive">
                    {promoNote}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={continueCheckout}
                className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
              >
                {fill(COPY.continue[lang], { a: dollars(total) })}
              </button>

              <button
                type="button"
                onClick={requestQuote}
                className="mt-2 w-full rounded-md border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                {COPY.quote[lang]}
              </button>

              <p className="mt-3 inline-flex items-start gap-1.5 text-xs leading-5 text-slate-500">
                <ShieldCheck
                  size={12}
                  className="mt-0.5 text-primary"
                />

                {COPY.saved[lang]}
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-500">
            <p className="flex items-start gap-2">
              <Check
                size={12}
                className="mt-0.5 text-primary"
              />

              {COPY.side1[lang]}
            </p>

            <p className="flex items-start gap-2">
              <Check
                size={12}
                className="mt-0.5 text-primary"
              />

              {COPY.side2[lang]}
            </p>

            <p className="flex items-start gap-2">
              <MessageSquare
                size={12}
                className="mt-0.5 text-primary"
              />

              {COPY.side3[lang]}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}