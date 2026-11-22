import assert from "node:assert/strict";
import fs from "node:fs";
import {
  decideLegacyDomainRenewalPreview,
  renderLegacyDomainRenewalPreview,
  NOTICE_EVIDENCE_MAX_AGE_DAYS,
  type LegacyDomainRenewalEvidence,
} from "../src/lib/web-migration/legacy-domain-renewal-preview";

const now = new Date("2026-11-22T23:50:00Z");
const original: LegacyDomainRenewalEvidence = {
  domain: "locactif.ca",
  landingHostname: "locactif.ca",
  expiresAt: "2026-12-14",
  checkedAt: "2026-11-22",
  verifiedRegistrar: true,
  domainHolderVerified: true,
  workspaceAssignmentVerified: true,
  ownerApprovedNotice: true,
  landingPageExplicitlyApproved: true,
  activeWebsiteOrCheckoutOnLanding: false,
  existingMailWillRemainUnchanged: true,
};
const plan = (overrides: Partial<LegacyDomainRenewalEvidence> = {}, asOf = now) =>
  decideLegacyDomainRenewalPreview({ ...original, ...overrides }, asOf);
const reason = (overrides: Partial<LegacyDomainRenewalEvidence>, expected: string) =>
  assert.equal(plan(overrides).reason, expected);

assert.equal(NOTICE_EVIDENCE_MAX_AGE_DAYS, 7);
assert.deepEqual(plan(), { eligible: true, reason: "eligible", daysRemaining: 22 });
reason({ verifiedRegistrar: false }, "unverified_registrar");
reason({ domainHolderVerified: false }, "unverified_holder_or_workspace");
reason({ workspaceAssignmentVerified: false }, "unverified_holder_or_workspace");
reason({ ownerApprovedNotice: false }, "missing_notice_approval");
reason({ landingPageExplicitlyApproved: false }, "missing_notice_approval");
reason({ activeWebsiteOrCheckoutOnLanding: true }, "live_site_preservation");
reason({ existingMailWillRemainUnchanged: false }, "live_site_preservation");
reason({ checkedAt: "2026-11-14" }, "stale_registrar_check");
reason({ checkedAt: "2026-11-29" }, "stale_registrar_check");
reason({ expiresAt: "2026-12-23" }, "outside_30_day_window");
reason({ expiresAt: "2026-11-21" }, "outside_30_day_window");
reason({ expiresAt: "2026-12-22" }, "eligible"); // 30 days inclusive
reason({ expiresAt: "2026-11-22" }, "eligible"); // zero days inclusive
reason({ checkedAt: "2026-11-15" }, "eligible"); // 7 days inclusive
reason({ expiresAt: "2026-02-29" }, "invalid_evidence");
reason({ checkedAt: "2026-02-30" }, "invalid_evidence");
reason({ expiresAt: "2026-11-22T00:00:00Z" }, "invalid_evidence");
reason({ domain: "locactif.ca/path" }, "invalid_evidence");
reason({ landingHostname: "other-company.ca" }, "invalid_evidence");
reason({ domain: "<script>.ca", landingHostname: "<script>.ca" }, "invalid_evidence");
assert.equal(plan({}, new Date("invalid")).reason, "invalid_evidence");
const preview = renderLegacyDomainRenewalPreview({ evidence: original, asOf: now });
assert.ok(preview);
assert.match(preview, /APERÇU OPÉRATEUR — NON PUBLIÉ/);
assert.match(preview, /locactif.ca/);
assert.match(preview, /Jours restants : <strong>22<\/strong>/);
assert.match(preview, /https:\/\/takatak.ca\/transfert/);
assert.match(preview, /noindex,nofollow/);
assert.match(preview, /Aucun paiement ni changement de site, DNS ou courriel/);
assert.equal(preview.includes("<form"), false);
assert.equal(preview.includes("window.location"), false);
assert.equal(preview.includes("fetch("), false);
assert.equal(renderLegacyDomainRenewalPreview({ evidence: { ...original, ownerApprovedNotice: false }, asOf: now }), null);
assert.equal(renderLegacyDomainRenewalPreview({ evidence: { ...original, activeWebsiteOrCheckoutOnLanding: true }, asOf: now }), null);

const source = fs.readFileSync("src/lib/web-migration/legacy-domain-renewal-preview.ts", "utf8");
assert.ok(!source.includes("process.env"), "no environment bypass");
assert.ok(!source.includes("writeFile"), "policy never writes or deploys");
assert.ok(!source.includes("sendEmail"), "no recipient delivery");
assert.ok(!source.includes("stripe."), "no payment");
assert.ok(!source.includes("switchDns"), "no DNS mutation");
console.log("Legacy 30-day notice policy and HTML review artifact: verified, no publishing or billing.");
