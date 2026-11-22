"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { submitWebsiteRequest } from "@/lib/website/website-requests";
import { EmailFallback } from "@/components/website/support/EmailFallback";
import {
  MANAGED_TRANSFER_REVIEW_FEE,
  buildManagedTransferLeadMessage,
  isValidDeclaredRenewalDate,
  type ExistingMailPreference,
} from "@/lib/web-migration/managed-transfer-intake";

type TransferScope = "site" | "domain" | "both";
type Provider = "MochaHost" | "GoDaddy" | "Enom" | "Other / unknown";

const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

const fieldClass =
  "mt-2 block w-full rounded-lg border border-white/20 bg-white px-3 py-3 text-base text-slate-900 placeholder:text-slate-500 focus:border-[#29C3FF] focus:outline-none focus:ring-2 focus:ring-[#29C3FF]";
const labelClass = "block text-sm font-semibold text-[#F5F8FC]";

export function LegacyTransferRequestForm() {
  const [scope, setScope] = useState<TransferScope>("both");
  const [provider, setProvider] = useState<Provider>("MochaHost");
  const [domain, setDomain] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [declaredRenewalDate, setDeclaredRenewalDate] = useState("");
  const [existingMail, setExistingMail] = useState<ExistingMailPreference>("keep_current");
  const [website, setWebsite] = useState(""); // Honeypot, never visible to human visitors.
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [down, setDown] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setError(null);
    const cleanDomain = domain.trim().toLowerCase().replace(/\.$/, "");
    if (!DOMAIN_RE.test(cleanDomain)) {
      setError("Inscrivez un nom de domaine valide, par exemple exemple.ca.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError("Indiquez un courriel ou un numéro de téléphone pour vous joindre.");
      return;
    }
    if (!isValidDeclaredRenewalDate(declaredRenewalDate)) {
      setError("Vérifiez la date de renouvellement ou laissez ce champ vide.");
      return;
    }
    if (!consent) {
      setError("Confirmez que vous êtes autorisé à faire cette demande.");
      return;
    }

    let transferSummary: string;
    try {
      transferSummary = buildManagedTransferLeadMessage({
        domain: cleanDomain,
        scope,
        provider,
        declaredRenewalDate,
        existingMail,
        notes,
      });
    } catch (error) {
      setError(error instanceof RangeError && error.message === "sensitive_data_not_allowed"
        ? "Ne saisissez pas de mots de passe, de codes EPP ou de clés confidentielles dans les notes."
        : "Veuillez vérifier les renseignements de transfert.");
      return;
    }

    setSending(true);
    try {
      const result = await submitWebsiteRequest({
        kind: "project_request",
        title: `Demande de transfert TAKATAK · ${cleanDomain}`,
        category: "legacy-migration",
        name: name.trim(),
        company: company.trim(),
        email: email.trim(),
        phone: phone.trim(),
        language: "fr",
        sourcePage: "/transfert",
        website,
        message: transferSummary,
      });

      if (result.status === "sent") {
        setReference(result.reference);
      } else if (result.status === "invalid") {
        setError("Vérifiez les champs indiqués. Le courriel, le téléphone ou le nom de domaine peut être invalide.");
      } else if (result.status === "rate_limited") {
        setError("Trop de demandes ont été envoyées. Réessayez plus tard.");
      } else {
        setError("Votre demande n'a pas pu être enregistrée. Aucun transfert n'a été lancé.");
        setDown(true);
      }
    } finally {
      setSending(false);
    }
  }

  if (reference) {
    return (
      <section role="status" className="rounded-2xl border border-white/15 bg-[#0B1B3D] p-6 sm:p-8">
        <CheckCircle2 className="h-10 w-10 text-emerald-400" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-bold">Demande reçue</h2>
        <p className="mt-3 leading-7 text-[#B8C4D3]">
          Votre demande de transfert a été transmise à TAKATAK. Conservez le numéro de référence
          ci-dessous. Nous vérifierons les services et communiquerons avec vous avant tout changement
          ou paiement.
        </p>
        <p className="mt-4 rounded-xl border border-white/20 p-4 font-mono text-xl tracking-widest text-white">
          {reference}
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/15 bg-[#0B1B3D] p-5 sm:p-8">
      <h2 className="text-xl font-bold">Demander mon transfert</h2>
      <p className="mt-2 text-sm leading-6 text-[#B8C4D3]">
        Simple demande de prise en charge. Aucun changement ni paiement automatique.
      </p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          Type de transfert *
          <select value={scope} onChange={(event) => setScope(event.target.value as TransferScope)} className={fieldClass}>
            <option value="both">Site Web et domaine</option>
            <option value="site">Site Web uniquement</option>
            <option value="domain">Domaine uniquement</option>
          </select>
        </label>
        <label className={labelClass}>
          Fournisseur actuel *
          <select value={provider} onChange={(event) => setProvider(event.target.value as Provider)} className={fieldClass}>
            <option value="MochaHost">MochaHost</option>
            <option value="GoDaddy">GoDaddy</option>
            <option value="Enom">Enom</option>
            <option value="Other / unknown">Autre / je ne sais pas</option>
          </select>
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Nom de domaine concerné *
          <input required type="text" inputMode="url" autoComplete="url" maxLength={253}
            placeholder="exemple.ca" value={domain} onChange={(event) => setDomain(event.target.value)}
            className={fieldClass} />
        </label>
        <label className={labelClass}>
          Votre nom *
          <input required autoComplete="name" maxLength={120} value={name}
            onChange={(event) => setName(event.target.value)} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Entreprise (facultatif)
          <input autoComplete="organization" maxLength={160} value={company}
            onChange={(event) => setCompany(event.target.value)} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Courriel
          <input type="email" autoComplete="email" maxLength={254} value={email}
            onChange={(event) => setEmail(event.target.value)} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Téléphone
          <input type="tel" autoComplete="tel" maxLength={40} value={phone}
            onChange={(event) => setPhone(event.target.value)} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Date de renouvellement connue (facultatif)
          <input type="date" value={declaredRenewalDate} onChange={(event) => setDeclaredRenewalDate(event.target.value)}
            className={fieldClass} />
          <span className="mt-1 block text-xs font-normal text-[#B8C4D3]">Date déclarée, à confirmer auprès du registraire. Aucune date inventée.</span>
        </label>
        <label className={labelClass}>
          Que faire des courriels existants? *
          <select value={existingMail} onChange={(event) => setExistingMail(event.target.value as ExistingMailPreference)} className={fieldClass}>
            <option value="keep_current">Les conserver sans changement</option>
            <option value="review_options">Discuter des possibilités</option>
            <option value="no_existing_mail">Aucun courriel existant</option>
          </select>
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Détails supplémentaires (facultatif)
          <textarea rows={3} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)}
            placeholder="Par exemple, je souhaite conserver mes courriels chez le fournisseur actuel."
            className={fieldClass} />
        </label>
      </div>
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Site personnel <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
      </div>
      <div className="mt-6 rounded-xl border border-[#29C3FF]/30 bg-[#060D1F] p-4" aria-label="Information tarifaire du transfert accompagné">
        <p className="text-sm font-semibold text-white">Service de transfert accompagné : {(MANAGED_TRANSFER_REVIEW_FEE.amountCents / 100).toLocaleString("fr-CA")} $ CAD + taxes applicables</p>
        <p className="mt-2 text-xs leading-5 text-[#B8C4D3]">Frais uniques proposés sous réserve d’un devis écrit approuvé. L’enregistrement, le renouvellement du domaine, l’hébergement et le forfait VIP annuel sont des services distincts. Aucun paiement n’est demandé maintenant.</p>
      </div>
      <label className="mt-6 flex items-start gap-3 text-sm leading-6 text-[#B8C4D3]">
        <input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[#1F8BFF]" />
        <span>Je confirme être autorisé à demander le transfert et j&apos;accepte d&apos;être contacté
          pour cette demande. Cela n&apos;autorise pas encore TAKATAK à modifier mon DNS,
          déplacer mon site ou transférer mon domaine.</span>
      </label>
      {error ? <p role="alert" className="mt-5 text-sm font-semibold text-red-200">{error}</p> : null}
      {down ? (
        <EmailFallback
          lang="fr"
          tone="dark"
          className="mt-3"
          subject={`TAKATAK · Transfert · ${domain.trim().toLowerCase() || "domaine"}`}
          lines={[
            `Domaine concerné : ${domain.trim().toLowerCase()}`,
            `Transfert demandé : ${scope === "site" ? "site Web uniquement" : scope === "domain" ? "domaine uniquement" : "site Web et domaine"}`,
            `Hébergeur ou registraire actuel : ${provider}`,
            declaredRenewalDate ? `Renouvellement déclaré : ${declaredRenewalDate} (à vérifier)` : "Renouvellement : inconnu",
            `Courriels existants : ${existingMail === "keep_current" ? "conserver" : existingMail === "review_options" ? "discuter des possibilités" : "aucun déclaré"}`,
            `Service accompagné proposé : 500 $ CAD + taxes, devis écrit requis`,
            name.trim() && `Nom : ${name.trim()}`,
            company.trim() && `Entreprise : ${company.trim()}`,
            phone.trim() && `Téléphone : ${phone.trim()}`,
            notes.trim() && `Notes : ${notes.trim()}`,
          ]}
        />
      ) : null}
      <button type="submit" disabled={sending}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1565D8] px-5 py-3.5 font-bold text-white hover:bg-[#104fab] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60">
        {sending ? "Envoi en cours…" : "Envoyer ma demande de transfert"}
        {!sending ? <ArrowRight className="h-5 w-5" aria-hidden="true" /> : null}
      </button>
      <p className="mt-4 text-xs leading-6 text-[#B8C4D3]">
        Vos coordonnées sont utilisées pour traiter cette demande, pas pour prélever un paiement.
        N&apos;inscrivez jamais de mots de passe, de codes de transfert EPP ni de renseignements bancaires ici.
      </p>
    </form>
  );
}
