import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { decodeJwt, decodeProtectedHeader, importJWK, jwtVerify } from "jose";

import { readPushConfig } from "../src/lib/push/config";
import { sendPushToAll } from "../src/lib/push/send";
import {
  endpointHash,
  pushOutcome,
  pushStopped,
  pushWithConsent,
  readPushState,
  validatePushSubscription,
  vapidAuthorization,
  vapidKeysValid,
  type PushConsentProof,
} from "../src/lib/push/subscription";
import { PUSH_CONSENT_VERSION, pushConsentText } from "../src/lib/push/topics";

async function main() {
  // Consent wording: who asks, what for, how to stop, and that it is not email/SMS consent.
  for (const lang of ["fr", "en"] as const) {
    const text = pushConsentText(lang);
    assert.ok(text.includes("Groupe TAKATAK"));
    assert.ok(/arrêter|stop/.test(text));
    assert.ok(/courriels|email/.test(text));
  }

  // Subscription validation.
  const good = {
    subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BNc_x-1", auth: "k_2" } },
    consent: true,
    consentVersion: PUSH_CONSENT_VERSION,
    language: "fr",
    sourcePage: "/offres/BF2026",
  };
  const ok = validatePushSubscription(good);
  assert.ok(ok.ok && ok.value.sourcePage === "/offres/BF2026");
  for (const consent of [undefined, false, "true"]) assert.ok(!validatePushSubscription({ ...good, consent }).ok);
  assert.ok(!validatePushSubscription({ ...good, consentVersion: "old" }).ok);
  assert.ok(!validatePushSubscription({ ...good, subscription: { ...good.subscription, endpoint: "http://insecure.example/x" } }).ok);
  assert.ok(!validatePushSubscription({ ...good, subscription: { ...good.subscription, endpoint: "https://u:p@x.example/a" } }).ok);
  assert.ok(!validatePushSubscription({ ...good, subscription: { ...good.subscription, keys: { p256dh: "a b", auth: "x" } } }).ok);

  // VAPID: a real P-256 pair signs a JWT the push service can verify.
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pubJwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  const privJwk = privateKey.export({ format: "jwk" }) as { d: string };
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pubJwk.x, "base64url"), Buffer.from(pubJwk.y, "base64url")]).toString("base64url");
  const vapid = { publicKey: raw, privateKey: privJwk.d, subject: "mailto:support@takatak.ca" };
  assert.ok(vapidKeysValid(vapid));
  assert.ok(!vapidKeysValid({ publicKey: "short", privateKey: privJwk.d }));
  const header = await vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", vapid, Date.UTC(2026, 9, 31, 12));
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(header);
  assert.ok(m && m[2] === raw);
  assert.equal(decodeProtectedHeader(m![1]).alg, "ES256");
  const claims = decodeJwt(m![1]);
  assert.equal(claims.aud, "https://fcm.googleapis.com");
  assert.equal(claims.sub, "mailto:support@takatak.ca");
  const verifyKey = await importJWK({ kty: "EC", crv: "P-256", x: pubJwk.x, y: pubJwk.y }, "ES256");
  await jwtVerify(m![1], verifyKey, { currentDate: new Date(Date.UTC(2026, 9, 31, 13)) });

  // Config: off without a valid pair.
  const env = { WEBSITE_LEADS_ENABLED: "true", WEBSITE_LEADS_CLIENT_ID: "3f2b8c1e-0a4d-4e7f-9b21-6c5d8e9f0a1b", PUSH_VAPID_PUBLIC_KEY: raw, PUSH_VAPID_PRIVATE_KEY: privJwk.d };
  assert.ok(readPushConfig(env).enabled);
  assert.ok(!readPushConfig({ ...env, PUSH_VAPID_PRIVATE_KEY: "" }).enabled);

  // State: active → stopped, proof kept; a new consent reactivates.
  const proof: PushConsentProof = {
    version: PUSH_CONSENT_VERSION, text: pushConsentText("fr"), language: "fr", givenAt: "2026-10-31T21:00:00.000Z",
    sourcePage: "/", sourceHash: "h", method: "own_prompt_then_browser_permission",
  };
  if (!ok.ok) throw new Error("unreachable");
  const s1 = pushWithConsent(null, ok.value, proof);
  assert.equal(s1.status, "active");
  assert.equal(s1.endpointHash, endpointHash(ok.value.endpoint));
  const s2 = pushStopped(s1, "push_service", new Date("2026-11-01T00:00:00Z"));
  assert.equal(s2.status, "stopped");
  assert.equal(s2.stoppedBy, "push_service");
  assert.equal(s2.consents.length, 1);
  assert.equal(pushWithConsent(s2, ok.value, proof).consents.length, 2);
  assert.equal(readPushState({ push: s2 })?.status, "stopped");

  // Push service answers.
  assert.equal(pushOutcome(201), "sent");
  assert.equal(pushOutcome(410), "gone");
  assert.equal(pushOutcome(404), "gone");
  assert.equal(pushOutcome(429), "retry");
  assert.equal(pushOutcome(400), "rejected");

  // Sending: payload-less POSTs with VAPID; gone endpoints are reported.
  const seen: Array<{ url: string; headers: Record<string, string> }> = [];
  const report = await sendPushToAll(
    [
      { id: "a", endpoint: "https://push.example/ok" },
      { id: "b", endpoint: "https://push.example/gone" },
      { id: "c", endpoint: "https://other.example/err" },
    ],
    vapid,
    async (url, init) => {
      seen.push({ url, headers: init.headers });
      return { status: url.endsWith("/ok") ? 201 : url.endsWith("/gone") ? 410 : 500 };
    },
  );
  assert.deepEqual(report, { sent: 1, gone: ["https://push.example/gone"], failed: 1 });
  assert.ok(seen.every((r) => r.headers.Authorization.startsWith("vapid t=") && r.headers["Content-Length"] === "0" && r.headers.TTL === "86400"));
}

main().then(
  () => console.log("push tests: OK"),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
