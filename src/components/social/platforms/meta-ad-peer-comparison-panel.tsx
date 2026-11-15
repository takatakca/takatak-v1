"use client";

import type { MetaAdCreativeReportRow } from "@/lib/social/analytics/meta-ad-creative-mapping";
import { compareMetaAdsWithinCampaign, PEER_MIN_IMPRESSIONS, PEER_MIN_SPEND } from "@/lib/social/analytics/meta-ad-peer-comparisons";

const METRICS = [
  { key: "ctr", unit: "%" },
  { key: "cpc", unit: "currency" },
  { key: "cpm", unit: "currency" },
] as const;

export function MetaAdPeerComparisonPanel({
  rows, complete, currency, locale,
}: {
  rows: readonly MetaAdCreativeReportRow[];
  complete: boolean;
  currency: string | null;
  locale: "fr" | "en";
}) {
  const fr = locale === "fr";
  const data = compareMetaAdsWithinCampaign(rows, complete);
  const code = currency && /^[A-Z]{3}$/.test(currency) ? currency : null;
  const number = new Intl.NumberFormat(fr ? "fr-CA" : "en-CA", { maximumFractionDigits: 2 });
  return (
    <section aria-labelledby="meta-ad-peer-title" className="mt-5 rounded-lg border border-[#DCE7F7] bg-[#F8FBFF] p-4 sm:p-5">
      <h4 id="meta-ad-peer-title" className="text-base font-semibold text-[#10213A]">
        {fr ? "Comparaisons entre publicités d'une même campagne" : "Within-campaign ad comparisons"}
      </h4>
      <p className="mt-2 text-sm leading-6 text-[#475569]">
        {fr
          ? "Médianes descriptives par publicité dans une seule campagne du compte sélectionné. Aucun classement de qualité, de rentabilité ou référence sectorielle. Les audiences et placements peuvent rester différents."
          : "Descriptive per-ad medians within one campaign of the selected account. Not a quality ranking, profitability claim or industry reference. Audiences and placements may still differ."}
      </p>
      {!complete || data.length === 0 ? (
        <p role="status" className="mt-3 rounded-md bg-white p-3 text-sm text-[#64748B]">
          {fr
            ? "Comparaison indisponible : rapport incomplet ou moins de 3 publicités admissibles dans une même campagne."
            : "Unavailable: incomplete report or fewer than 3 eligible ads in any one campaign."}
        </p>
      ) : (
        <>
          <p className="mt-3 text-xs text-[#64748B]">
            {fr
              ? `Minimum par publicité : ${PEER_MIN_IMPRESSIONS.toLocaleString("fr-CA")} impressions et ${PEER_MIN_SPEND} ${code ?? "unités monétaires"} de dépenses. Chaque médiane exige 3 valeurs valides.`
              : `Per-ad minimum: ${PEER_MIN_IMPRESSIONS.toLocaleString("en-CA")} impressions and ${PEER_MIN_SPEND} ${code ?? "currency units"} spent. Each median requires 3 valid values.`}
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {data.slice(0, 8).map((campaign) => (
              <div key={campaign.campaignId} className="rounded-lg border border-[#E2E8F0] bg-white p-4">
                <h5 className="font-semibold text-[#10213A]">{campaign.campaignName}</h5>
                <p className="mt-1 text-xs text-[#64748B]">
                  {fr ? `${campaign.sampleSize} publicités admissibles` : `${campaign.sampleSize} eligible ads`}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {METRICS.map((metric) => {
                    const value = campaign.medians[metric.key];
                    return (
                      <div key={metric.key} className="min-w-0">
                        <p className="text-xs text-[#64748B]">{fr ? "Médiane " : "Median "}{metric.key.toUpperCase()}</p>
                        <p className="break-words text-sm font-semibold text-[#10213A]">
                          {value === null
                            ? "—"
                            : `${number.format(value)}${metric.unit === "%" ? "%" : code ? ` ${code}` : ""}`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#64748B]">
            {fr
              ? "Résultats tirés uniquement des publicités déjà chargées. Aucune lecture Meta supplémentaire et aucune comparaison entre clients."
              : "Uses only already-loaded ads. No additional Meta calls or cross-client comparisons."}
          </p>
        </>
      )}
    </section>
  );
}
