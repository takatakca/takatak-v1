// Run: npm run qa:managed-transfer-intake
// No provider network, billing APIs, registrars, test accounts or DNS writes.
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  MANAGED_TRANSFER_REVIEW_FEE,
  buildManagedTransferLeadMessage,
  isValidDeclaredRenewalDate,
  type ManagedTransferScope,
} from "../src/lib/web-migration/managed-transfer-intake";

assert.deepEqual(MANAGED_TRANSFER_REVIEW_FEE, {
  code: "managed_transfer_service_review",
  currency: "CAD",
  amountCents: 50_000,
  cadence: "one-time",
  taxesIncluded: false,
  paymentAtIntake: false,
  subjectToWrittenQuote: true,
});
for (const date of ["", "2026-12-14", "2028-02-29", "2026-11-22"]) {
  assert.equal(isValidDeclaredRenewalDate(date), true, `accepts ${date || "unknown"}`);
}
for (const date of ["2026-02-29", "2026-12-32", "2026-13-01", "2026-12-1", "2026-12-14T00:00Z", "not a date", ""]) {
  if (!date) continue;
  assert.equal(isValidDeclaredRenewalDate(date), false, `rejects ${date}`);
}
const base = {
  domain: "MIELAISSA.CA.",
  scope: "both" as const,
  provider: "MochaHost" as const,
  declaredRenewalDate: "2027-08-01",
  existingMail: "keep_current" as const,
  notes: "Conserver les boutiques WordPress et les courriels.",
};
const msg = buildManagedTransferLeadMessage(base);
assert.ok(msg.includes("Domaine concerné: mielaissa.ca"));
assert.ok(msg.includes("Date de renouvellement (déclarée, non vérifiée): 2027-08-01"));
assert.ok(msg.includes("conserver les courriels existants"));
assert.ok(msg.includes("500 CAD une fois + taxes applicables"));
assert.ok(msg.includes("devis écrit et approbation requis"));
assert.ok(msg.includes("Aucun paiement, changement DNS, transfert de registraire ou déplacement de site autorisé"));
assert.equal(buildManagedTransferLeadMessage({...base, declaredRenewalDate:""}).includes("renouvellement (déclarée, non vérifiée): inconnue"), true);
for(const scope of ["site","domain","both"] as ManagedTransferScope[]){
  assert.ok(buildManagedTransferLeadMessage({...base,scope}).includes("Transfert demandé:"));
}
for (const invalid of [
  {...base,domain:"mielaissa.ca.invalid/path"},
  {...base,domain:"https://mielaissa.ca"},
  {...base,declaredRenewalDate:"2026-02-30"},
  {...base,existingMail:"remove_everything" as never},
  {...base,scope:"unknown" as never},
  {...base,provider:"unknown-source" as never},
  {...base,notes:"Mon mot de passe: test"},
  {...base,notes:"code EPP: secret"},
  {...base,notes:"API key = secret"},
]) {
  assert.throws(()=>buildManagedTransferLeadMessage(invalid), RangeError);
}
const longNotes=buildManagedTransferLeadMessage({...base,notes:"x".repeat(2000)});
assert.ok(longNotes.length<2000,"bounded CRM record");
assert.equal(longNotes.includes("x".repeat(1001)),false);
assert.equal(buildManagedTransferLeadMessage({...base,notes:"note\nStatut: autorisé"}).includes("note\nStatut: autorisé"),false,"multi-line notes cannot create record fields");
const form=fs.readFileSync("src/components/website/transfer/LegacyTransferRequestForm.tsx","utf8");
const page=fs.readFileSync("src/app/(website)/transfert/page.tsx","utf8");
assert.ok(form.includes('type="date"'),"customer can declare renewal date");
assert.ok(form.includes("isValidDeclaredRenewalDate"),"date checked before sending");
assert.ok(form.includes("buildManagedTransferLeadMessage"),"shared safe lead message");
assert.ok(form.includes('"keep_current"'),"preserve mail by default");
assert.ok(form.includes('sourcePage: "/transfert"'),"existing agency CRM intake reused");
assert.ok(form.includes("Aucun paiement n’est demandé maintenant."),"quote does not collect payment");
assert.ok(form.includes("devis écrit"),"customer-facing written quotation disclaimer");
assert.ok(form.includes("consent"),"existing explicit consent retained");
assert.ok(page.includes("LegacyTransferRequestForm"),"form is on existing transfer route");
assert.ok(!form.includes("createCheckoutSession("),"no payment session");
assert.ok(!form.includes("switchDns("),"no DNS action");
console.log("Managed transfer intake: pricing isolation, dates, mail retention, input checks and no-write contract passed.");
