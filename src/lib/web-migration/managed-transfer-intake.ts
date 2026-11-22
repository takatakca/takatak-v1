/**
 * Public managed-transfer request summary only.
 *
 * This offer is deliberately separate from:
 * - basic registrar transfer (website catalog),
 * - VIP annual subscription,
 * - recurring domain renewal or web hosting.
 * The request is NOT a checkout, contract acceptance, ownership verification,
 * DNS approval or registrar authorization.
 */
export const MANAGED_TRANSFER_REVIEW_FEE = Object.freeze({
  code: "managed_transfer_service_review",
  currency: "CAD" as const,
  amountCents: 50_000,
  cadence: "one-time" as const,
  taxesIncluded: false,
  paymentAtIntake: false,
  subjectToWrittenQuote: true,
});

export type ManagedTransferScope = "site" | "domain" | "both";
export type ManagedTransferProvider = "MochaHost" | "GoDaddy" | "Enom" | "Other / unknown";
export type ExistingMailPreference = "keep_current" | "review_options" | "no_existing_mail";

const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDeclaredRenewalDate(date: string): boolean {
  if (!date) return true; // Optional. Never invent a date.
  const match = DATE_RE.exec(date);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const ms = Date.UTC(year, month - 1, day);
  const parsed = new Date(ms);
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
}

function oneLine(value: string): string {
  // Notes are customer-provided and never proof of ownership, payment or consent.
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
}

export function buildManagedTransferLeadMessage(input: {
  domain: string;
  scope: ManagedTransferScope;
  provider: ManagedTransferProvider;
  declaredRenewalDate: string;
  existingMail: ExistingMailPreference;
  notes: string;
}): string {
  const domain = oneLine(input.domain).toLowerCase().replace(/\.$/, "");
  if (!DOMAIN_RE.test(domain)) throw new RangeError("invalid_domain");
  if (!["site", "domain", "both"].includes(input.scope)) throw new RangeError("invalid_scope");
  if (!["MochaHost", "GoDaddy", "Enom", "Other / unknown"].includes(input.provider)) throw new RangeError("invalid_provider");
  if (!["keep_current", "review_options", "no_existing_mail"].includes(input.existingMail)) throw new RangeError("invalid_mail_preference");
  if (!isValidDeclaredRenewalDate(input.declaredRenewalDate)) throw new RangeError("invalid_renewal_date");
  const notes = oneLine(input.notes).slice(0, 1000);
  // Reject obvious secret disclosures rather than placing them in a CRM lead.
  if (/(?:password|mot de passe|auth(?:orization)? code|code epp|secret key|private key|api key|clé api)\s*[:=]/i.test(notes)) {
    throw new RangeError("sensitive_data_not_allowed");
  }
  const scopeLabels: Record<ManagedTransferScope, string> = {
    site: "site Web uniquement",
    domain: "domaine uniquement",
    both: "site Web et domaine",
  };
  const mailLabels: Record<ExistingMailPreference, string> = {
    keep_current: "conserver les courriels existants chez le fournisseur actuel",
    review_options: "discuter des options de courriel sans aucune modification automatique",
    no_existing_mail: "aucun service de courriel existant déclaré",
  };

  return [
    `Domaine concerné: ${domain}`,
    `Transfert demandé: ${scopeLabels[input.scope]}`,
    `Fournisseur actuel (déclaré par le client): ${input.provider}`,
    `Date de renouvellement (déclarée, non vérifiée): ${input.declaredRenewalDate || "inconnue"}`,
    `Traitement des courriels demandé: ${mailLabels[input.existingMail]}`,
    "Offre de transfert accompagné: frais de service indicatifs 500 CAD une fois + taxes applicables; devis écrit et approbation requis. Autres abonnements et frais de domaine distincts.",
    "Autorisation: prise de contact seulement. Aucun paiement, changement DNS, transfert de registraire ou déplacement de site autorisé.",
    ...(notes ? [`Notes du demandeur (non vérifiées): ${notes}`] : []),
  ].join("\n");
}
