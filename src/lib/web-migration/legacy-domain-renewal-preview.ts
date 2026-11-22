/**
 * Domain renewal transition notice: operator PREVIEW ONLY.
 *
 * Does not import MochaHost data, contact customers, change live websites,
 * deploy files, perform a registrar transfer, renew anything or charge a fee.
 * Inputs are verified by an authorized operator OUTSIDE this pure function;
 * a boolean in a JSON file is not independent registrar evidence.
 */
export type LegacyDomainRenewalEvidence = Readonly<{
  domain: string;
  landingHostname: string;
  expiresAt: string;
  checkedAt: string;
  verifiedRegistrar: boolean;
  domainHolderVerified: boolean;
  workspaceAssignmentVerified: boolean;
  ownerApprovedNotice: boolean;
  landingPageExplicitlyApproved: boolean;
  activeWebsiteOrCheckoutOnLanding: boolean;
  existingMailWillRemainUnchanged: boolean;
}>;

export type LegacyDomainNoticeDecision = Readonly<{
  eligible: boolean;
  reason: "eligible" | "invalid_evidence" | "unverified_registrar" |
    "unverified_holder_or_workspace" | "missing_notice_approval" |
    "live_site_preservation" | "stale_registrar_check" |
    "outside_30_day_window";
  daysRemaining: number | null;
}>;

const DAY_MS = 86_400_000;
const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const NOTICE_EVIDENCE_MAX_AGE_DAYS = 7;

function parseDay(value: string): number | null {
  const parts = DAY_RE.exec(value);
  if (!parts) return null;
  const [year, month, day] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const ms = Date.UTC(year, month - 1, day);
  const checked = new Date(ms);
  return checked.getUTCFullYear() === year &&
    checked.getUTCMonth() === month - 1 &&
    checked.getUTCDate() === day ? ms : null;
}

function normalizedHostname(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "");
}

function result(reason: LegacyDomainNoticeDecision["reason"], daysRemaining: number | null = null): LegacyDomainNoticeDecision {
  return { eligible: reason === "eligible", reason, daysRemaining };
}

/** Eligibility is only for a reviewable stand-alone HTML PREVIEW, never live publication. */
export function decideLegacyDomainRenewalPreview(
  evidence: LegacyDomainRenewalEvidence,
  asOf: Date,
): LegacyDomainNoticeDecision {
  if (!Number.isFinite(asOf.getTime())) return result("invalid_evidence");
  const domain = normalizedHostname(evidence.domain);
  const host = normalizedHostname(evidence.landingHostname);
  const expires = parseDay(evidence.expiresAt);
  const checked = parseDay(evidence.checkedAt);
  if (!DOMAIN_RE.test(domain) || !DOMAIN_RE.test(host) || domain !== host ||
      expires === null || checked === null) return result("invalid_evidence");
  if (!evidence.verifiedRegistrar) return result("unverified_registrar");
  if (!evidence.domainHolderVerified || !evidence.workspaceAssignmentVerified) {
    return result("unverified_holder_or_workspace");
  }
  if (!evidence.ownerApprovedNotice || !evidence.landingPageExplicitlyApproved) {
    return result("missing_notice_approval");
  }
  if (evidence.activeWebsiteOrCheckoutOnLanding || !evidence.existingMailWillRemainUnchanged) {
    return result("live_site_preservation");
  }
  const today = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const checkedAge = (today - checked) / DAY_MS;
  if (checkedAge < 0 || checkedAge > NOTICE_EVIDENCE_MAX_AGE_DAYS) {
    return result("stale_registrar_check");
  }
  const days = (expires - today) / DAY_MS;
  if (days < 0 || days > 30) return result("outside_30_day_window", days);
  return result("eligible", days);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Generates an accessible HTML review artifact, not an embeddable widget,
 * not an authorized deployment and not a replacement for WordPress index.php.
 */
export function renderLegacyDomainRenewalPreview(input: {
  evidence: LegacyDomainRenewalEvidence;
  asOf: Date;
}): string | null {
  const decision = decideLegacyDomainRenewalPreview(input.evidence, input.asOf);
  if (!decision.eligible || decision.daysRemaining === null) return null;
  const domain = escapeHtml(normalizedHostname(input.evidence.domain));
  const expiry = escapeHtml(input.evidence.expiresAt);
  const dayCount = decision.daysRemaining;
  return '<!doctype html>\n' +
    '<html lang="fr-CA"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow">' +
    '<title>APERÇU — Avis de renouvellement TAKATAK</title>' +
    '<style>body{font-family:system-ui,sans-serif;background:#060D1F;color:#F5F8FC;' +
    'min-height:100vh;display:grid;place-items:center;margin:0;padding:24px}' +
    'main{max-width:680px;border:1px solid #2C5389;border-radius:20px;' +
    'padding:30px;background:#0B1B3D}h1{line-height:1.2}' +
    '.preview{font-weight:bold;color:#FFCA70}' +
    'a{display:inline-block;background:#1565D8;color:white;border-radius:10px;' +
    'padding:13px 19px;font-weight:700;text-decoration:none}' +
    'p{line-height:1.65;color:#D7E4F4}</style></head><body><main>' +
    '<p class="preview">APERÇU OPÉRATEUR — NON PUBLIÉ</p>' +
    '<p>GROUPE TAKATAK · Avis de renouvellement</p>' +
    '<h1>Votre domaine ' + domain + ' arrive à échéance</h1>' +
    '<p>Échéance vérifiée auprès du registraire : <strong>' + expiry + '</strong>.' +
    ' Jours restants : <strong>' + String(dayCount) + '</strong>.</p>' +
    '<p>Pour discuter du transfert de votre domaine ou site Web vers TAKATAK, ' +
    'envoyez une demande sans engagement.</p>' +
    '<a href="https://takatak.ca/transfert">Demander mon transfert</a>' +
    '<p>Cette demande ne renouvelle pas automatiquement votre domaine. ' +
    'Aucun paiement ni changement de site, DNS ou courriel n’est effectué.</p>' +
    '</main></body></html>';
}
