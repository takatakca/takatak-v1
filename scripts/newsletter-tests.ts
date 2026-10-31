import assert from "node:assert/strict";

import {
  CONSENT_VERSION,
  confirmationEmail,
  confirmed,
  consentText,
  maySend,
  messageFooter,
  readState,
  signToken,
  unsubscribed,
  validateSignup,
  verifyToken,
  withConsent,
  type ConsentProof,
} from "../src/lib/newsletter/consent";
import { readNewsletterConfig, readNewsletterLinkConfig } from "../src/lib/newsletter/config";
import { applyLink, recordSignup, type NewsletterDb } from "../src/lib/newsletter/store";

const sender = { name: "Groupe TAKATAK", address: "123 rue Exemple, Montréal QC H0H 0H0", email: "support@takatak.ca", web: "takatak.ca" };

// Consent wording names who asks, the address, a contact, and the right to withdraw.
for (const lang of ["fr", "en"] as const) {
  const text = consentText(lang, sender);
  for (const part of [sender.name, sender.address, sender.email, sender.web]) assert.ok(text.includes(part), `${lang}: ${part}`);
  assert.ok(/retirer|withdraw/.test(text));
  const footer = messageFooter(lang, sender, "https://takatak.ca/infolettre/desabonnement?t=x");
  assert.ok(footer.includes("desabonnement?t=x") && footer.includes(sender.address));
}

// Consent must be the visitor's own `true`, for the current wording.
const good = { email: " Marie@Exemple.CA ", consent: true, consentVersion: CONSENT_VERSION, language: "fr", topics: ["tips", "nope"], sourcePage: "/" };
const ok = validateSignup(good);
assert.ok(ok.ok);
if (ok.ok) {
  assert.equal(ok.value.email, "marie@exemple.ca");
  assert.deepEqual(ok.value.topics, ["tips"]);
  assert.equal(ok.honeypot, false);
}
for (const consent of [undefined, false, "true", "on", 1]) {
  const r = validateSignup({ ...good, consent });
  assert.ok(!r.ok && r.fieldErrors.consent === "required", `consent=${String(consent)} refused`);
}
assert.ok(!validateSignup({ ...good, consentVersion: "old" }).ok, "stale wording refused");
assert.ok(!validateSignup({ ...good, email: "pas-un-courriel" }).ok);
const all = validateSignup({ ...good, topics: undefined });
assert.ok(all.ok && all.value.topics.length === 3, "no topic picked = all topics");
const bot = validateSignup({ ...good, website: "http://spam" });
assert.ok(bot.ok && bot.honeypot);
const page = validateSignup({ ...good, sourcePage: "https://evil.example/x" });
assert.ok(page.ok && page.value.sourcePage === null);

// Signed links: only for this purpose, this id, this secret.
const secret = "s".repeat(40);
const id = "3f2b8c1e-0a4d-4e7f-9b21-6c5d8e9f0a1b";
const unsub = signToken("unsubscribe", id, secret);
assert.equal(verifyToken(unsub, "unsubscribe", secret), id);
assert.equal(verifyToken(unsub, "confirm", secret), null, "an unsubscribe link cannot confirm");
assert.equal(verifyToken(unsub, "unsubscribe", "t".repeat(40)), null);
assert.equal(verifyToken(unsub.slice(0, -1) + (unsub.endsWith("A") ? "B" : "A"), "unsubscribe", secret), null);
const otherId = "00000000-0000-4000-8000-000000000000";
const forged = `${Buffer.from(otherId).toString("base64url")}.${unsub.split(".")[1]}`;
assert.equal(verifyToken(forged, "unsubscribe", secret), null, "a signature cannot be moved to another id");
assert.equal(verifyToken(null, "unsubscribe", secret), null);

// State: pending → confirmed → unsubscribed, proof kept; only confirmed may be sent.
const proof = (givenAt: string): ConsentProof => ({
  version: CONSENT_VERSION, text: consentText("fr", sender), language: "fr", givenAt, sourcePage: "/", sourceHash: "h", method: "web_form_checkbox",
});
const now = new Date("2026-10-31T14:00:00Z");
let s = withConsent(null, proof(now.toISOString()), ["offers"]);
assert.equal(s.status, "pending");
assert.equal(maySend(s), false, "nothing is sent before confirmation");
s = confirmed(s, now);
assert.equal(s.status, "confirmed");
assert.ok(maySend(s));
s = unsubscribed(s, now);
assert.equal(s.status, "unsubscribed");
assert.equal(maySend(s), false);
assert.equal(confirmed(s, now).status, "unsubscribed", "an old confirm link cannot undo an unsubscribe");
assert.equal(s.consents.length, 1, "proof kept after withdrawal");
const again = withConsent(s, proof("2026-11-02T10:00:00Z"), ["tips"]);
assert.equal(again.status, "pending", "re-subscribing asks for confirmation again");
assert.equal(again.consents.length, 2);
assert.equal(withConsent(confirmed(withConsent(null, proof(now.toISOString()), ["news"]), now), proof(now.toISOString()), ["news"]).status, "confirmed");
assert.deepEqual(readState({ newsletter: again })?.status, "pending");
assert.equal(readState({ other: 1 }), null);

// The confirmation email carries the link, the identification and an unsubscribe.
const mail = confirmationEmail("fr", sender, "https://takatak.ca/infolettre/confirmer?t=a", "https://takatak.ca/infolettre/desabonnement?t=b");
assert.ok(mail.text.includes("confirmer?t=a") && mail.text.includes("desabonnement?t=b") && mail.text.includes(sender.address));

// Config: off until the workspace, the secret and the mailing address are set.
const env = {
  WEBSITE_LEADS_ENABLED: "true",
  WEBSITE_LEADS_CLIENT_ID: "3f2b8c1e-0a4d-4e7f-9b21-6c5d8e9f0a1b",
  NEWSLETTER_TOKEN_SECRET: secret,
  NEWSLETTER_SENDER_ADDRESS: sender.address,
};
const cfg = readNewsletterConfig(env);
assert.ok(cfg.enabled && cfg.sender.name === "Groupe TAKATAK" && cfg.sender.address === sender.address);
const noAddress = readNewsletterConfig({ ...env, NEWSLETTER_SENDER_ADDRESS: "" });
assert.ok(!noAddress.enabled && noAddress.missing.includes("NEWSLETTER_SENDER_ADDRESS"));
assert.ok(!readNewsletterConfig({ ...env, NEWSLETTER_TOKEN_SECRET: "short" }).enabled);
// Unsubscribe links keep working without the sign-up address.
assert.ok(readNewsletterLinkConfig({ ...env, NEWSLETTER_SENDER_ADDRESS: "" }));
assert.equal(readNewsletterLinkConfig({ ...env, WEBSITE_LEADS_ENABLED: "false" }), null);

// Store, on an in-memory stand-in for the database.
type Row = { id: string; clientId: string; leadSourceId: string; email: string; status: string; metadata: unknown; createdAt: Date };
const rows: Row[] = [];
const audits: string[] = [];
let sourceRow: { id: string; name: string } | null = null;
let n = 0;
const tx = {
  leadSource: {
    findFirst: async () => sourceRow,
    create: async ({ data }: { data: { name: string } }) => (sourceRow = { id: "src-1", name: data.name }),
  },
  lead: {
    findFirst: async ({ where }: { where: { email?: string; id?: string; leadSource?: { name: string } } }) =>
      rows.find((r) => (where.email ? r.email === where.email : r.id === where.id) && (!where.leadSource || sourceRow?.name === where.leadSource.name)) ?? null,
    count: async () => rows.length,
    create: async ({ data }: { data: Omit<Row, "id" | "createdAt"> }) => {
      const row = { ...data, id: `00000000-0000-4000-8000-00000000000${++n}`, createdAt: new Date() } as Row;
      rows.push(row);
      return row;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
      const row = rows.find((r) => r.id === where.id)!;
      Object.assign(row, data);
      return row;
    },
  },
  auditLog: { create: async ({ data }: { data: { action: string } }) => void audits.push(data.action) },
};
const db = { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } as unknown as NewsletterDb;
const clientId = env.WEBSITE_LEADS_CLIENT_ID;
const signup = { email: "a@b.ca", language: "fr" as const, topics: ["offers" as const], sourcePage: "/", consentVersion: CONSENT_VERSION };

async function storeTests() {
  const t0 = new Date("2026-10-31T14:00:00Z");
  const first = await recordSignup(db, { clientId, signup, proof: proof(t0.toISOString()), now: t0 });
  assert.equal(first.status, "pending");
  assert.equal(first.sendConfirmation, true);
  const t1 = new Date(t0.getTime() + 60_000);
  const repeat = await recordSignup(db, { clientId, signup, proof: proof(t1.toISOString()), now: t1 });
  assert.equal(repeat.sendConfirmation, false, "no second email within 10 minutes");
  assert.equal(rows.length, 1, "one record per address");
  assert.equal(await applyLink(db, { clientId, id: first.id, action: "confirm", now: t1 }), "confirmed");
  assert.equal(await applyLink(db, { clientId, id: first.id, action: "unsubscribe", now: t1 }), "unsubscribed");
  assert.equal(rows[0].status, "archived");
  assert.equal(readState(rows[0].metadata)?.consents.length, 1, "proof kept");
  assert.equal(await applyLink(db, { clientId, id: "00000000-0000-4000-8000-000000000099", action: "unsubscribe" }), null);
  assert.deepEqual(audits, ["newsletter_consent_recorded", "newsletter_confirmed", "newsletter_unsubscribed"]);
}

storeTests().then(
  () => console.log("newsletter tests: OK"),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
