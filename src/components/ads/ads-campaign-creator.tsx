"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type CampaignScope = "single_site" | "local_network" | "max_lead_pro";
type PricingModel = "fixed" | "cpc";

type PublisherOption = {
  id: string;
  name: string;
  placements: Array<{ id: string; code: string; name: string }>;
};

type CreateResponse = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

const SCOPE_LABELS: Record<CampaignScope, string> = {
  single_site: "TAKATAK ADS Direct — un emplacement",
  local_network: "TAKATAK ADS Réseau local",
  max_lead_pro: "TAKATAK Max Lead Pro",
};

function centsFromDollars(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function AdsCampaignCreator({
  scopes,
  publishers,
}: {
  scopes: CampaignScope[];
  publishers: PublisherOption[];
}) {
  const router = useRouter();
  const [scope, setScope] = useState<CampaignScope>(scopes[0] ?? "single_site");
  const [pricingModel, setPricingModel] = useState<PricingModel>("fixed");
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [bid, setBid] = useState("");
  const [placementId, setPlacementId] = useState("");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [cta, setCta] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");

  const placements = publishers.flatMap((publisher) =>
    publisher.placements.map((placement) => ({
      ...placement,
      publisherName: publisher.name,
    })),
  );

  const canCreate = scopes.length > 0 && (
    scope !== "single_site" || placements.length > 0
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setSuccess("");
    setFieldErrors({});

    const budgetCents = centsFromDollars(budget);
    const bidCents = pricingModel === "cpc" ? centsFromDollars(bid) : null;
    if (budgetCents === null || (pricingModel === "cpc" && bidCents === null)) {
      setError("Vérifiez le budget et la mise : montant positif, deux décimales maximum.");
      return;
    }
    if (scope === "single_site" && !placementId) {
      setFieldErrors({ placementIds: "Sélectionnez un emplacement disponible." });
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/ads/campaigns", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          scope,
          pricingModel,
          budgetCents,
          dailyBudgetCents: null,
          bidCents,
          businessBrandId: null,
          objective: null,
          startsAt: null,
          endsAt: null,
          targeting: {},
          placementIds: scope === "single_site" ? [placementId] : [],
          creative: {
            name: "Créatif principal",
            headline: headline.trim(),
            body: body.trim() || null,
            callToAction: cta.trim() || null,
            destinationUrl: destinationUrl.trim(),
            imageUrl: imageUrl.trim() || null,
          },
        }),
      });

      const result = (await response.json().catch(() => ({}))) as CreateResponse;
      if (!response.ok || !result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setError(result.message || "Impossible d’enregistrer le brouillon.");
        return;
      }

      setName("");
      setBudget("");
      setBid("");
      setHeadline("");
      setBody("");
      setCta("");
      setDestinationUrl("");
      setImageUrl("");
      setSuccess("Campagne enregistrée comme brouillon. Elle ne sera pas diffusée avant approbation et activation.");
      router.refresh();
    } catch {
      setError("Connexion indisponible. Le brouillon n’a pas été confirmé.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-offset-2 focus-visible:outline-2 focus-visible:outline-blue-600";
  const labelClass = "block text-sm font-medium text-slate-800";

  if (scopes.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        La création de campagnes nécessite un abonnement TAKATAK ADS admissible.
        Vous pouvez consulter les campagnes existantes sans en lancer de nouvelles.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" aria-label="Créer une campagne publicitaire">
      <p className="text-sm text-slate-600">
        Préparez votre publicité ici. Le brouillon ne dépense aucun budget et ne
        lance aucune diffusion automatiquement.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass} htmlFor="ads-campaign-name">
          Nom de la campagne
          <input id="ads-campaign-name" className={inputClass} type="text"
            value={name} onChange={(e) => setName(e.target.value)}
            required maxLength={120} placeholder="Ex. Offre hockey Verdun" />
          {fieldErrors.name ? <span className="mt-1 block text-xs text-red-700">{fieldErrors.name}</span> : null}
        </label>
        <label className={labelClass} htmlFor="ads-campaign-scope">
          Type de campagne
          <select id="ads-campaign-scope" className={inputClass}
            value={scope} onChange={(e) => { setScope(e.target.value as CampaignScope); setError(""); }}>
            {scopes.map((item) => (
              <option key={item} value={item}>{SCOPE_LABELS[item]}</option>
            ))}
          </select>
        </label>
        {scope === "single_site" ? (
          <label className={labelClass} htmlFor="ads-campaign-placement">
            Emplacement publicitaire
            <select id="ads-campaign-placement" className={inputClass}
              value={placementId} required onChange={(e) => setPlacementId(e.target.value)}>
              <option value="">Choisir un emplacement</option>
              {placements.map((placement) => (
                <option key={placement.id} value={placement.id}>
                  {placement.publisherName} — {placement.name} ({placement.code})
                </option>
              ))}
            </select>
            {fieldErrors.placementIds ? <span className="mt-1 block text-xs text-red-700">{fieldErrors.placementIds}</span> : null}
            {placements.length === 0 ? <span className="mt-1 block text-xs text-amber-800">Aucun emplacement actif n’est encore disponible.</span> : null}
          </label>
        ) : null}
        <label className={labelClass} htmlFor="ads-campaign-pricing">
          Modèle de tarification
          <select id="ads-campaign-pricing" className={inputClass}
            value={pricingModel} onChange={(e) => setPricingModel(e.target.value as PricingModel)}>
            <option value="fixed">Budget fixe</option>
            <option value="cpc">Coût par clic (CPC)</option>
          </select>
        </label>
        <label className={labelClass} htmlFor="ads-campaign-budget">
          Budget total (CAD)
          <input id="ads-campaign-budget" className={inputClass} type="text"
            inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)}
            placeholder="100.00" required />
          {fieldErrors.budgetCents ? <span className="mt-1 block text-xs text-red-700">{fieldErrors.budgetCents}</span> : null}
        </label>
        {pricingModel === "cpc" ? (
          <label className={labelClass} htmlFor="ads-campaign-bid">
            Mise maximale par clic (CAD)
            <input id="ads-campaign-bid" className={inputClass} type="text"
              inputMode="decimal" value={bid} onChange={(e) => setBid(e.target.value)}
              placeholder="0.50" required />
            {fieldErrors.bidCents ? <span className="mt-1 block text-xs text-red-700">{fieldErrors.bidCents}</span> : null}
          </label>
        ) : null}
      </div>
      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-sm font-semibold text-slate-950">Créatif principal</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <label className={labelClass} htmlFor="ads-creative-headline">
            Titre de la publicité
            <input id="ads-creative-headline" className={inputClass} type="text"
              value={headline} onChange={(e) => setHeadline(e.target.value)}
              required maxLength={160} />
            {fieldErrors.headline ? <span className="mt-1 block text-xs text-red-700">{fieldErrors.headline}</span> : null}
          </label>
          <label className={labelClass} htmlFor="ads-creative-cta">
            Appel à l’action (facultatif)
            <input id="ads-creative-cta" className={inputClass} type="text"
              value={cta} onChange={(e) => setCta(e.target.value)}
              maxLength={80} placeholder="En savoir plus" />
          </label>
          <label className={labelClass} htmlFor="ads-creative-link">
            Adresse de destination (https://)
            <input id="ads-creative-link" className={inputClass} type="url"
              value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)}
              required maxLength={2048} placeholder="https://exemple.ca/offre" />
            {fieldErrors.destinationUrl ? <span className="mt-1 block text-xs text-red-700">{fieldErrors.destinationUrl}</span> : null}
          </label>
          <label className={labelClass} htmlFor="ads-creative-image">
            Adresse de l’image (facultatif)
            <input id="ads-creative-image" className={inputClass} type="url"
              value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
              maxLength={2048} placeholder="https://exemple.ca/publicite.jpg" />
            {fieldErrors.imageUrl ? <span className="mt-1 block text-xs text-red-700">{fieldErrors.imageUrl}</span> : null}
          </label>
        </div>
        <label className={labelClass + " mt-4"} htmlFor="ads-creative-body">
          Description de la publicité (facultatif)
          <textarea id="ads-creative-body" className={inputClass} rows={3}
            value={body} onChange={(e) => setBody(e.target.value)}
            maxLength={1000} />
        </label>
      </div>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {success ? <p role="status" className="text-sm text-green-700">{success}</p> : null}
      <button type="submit" disabled={!canCreate || busy}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? "Enregistrement…" : "Enregistrer le brouillon"}
      </button>
    </form>
  );
}
