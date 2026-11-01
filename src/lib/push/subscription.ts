// Push deal alerts: subscription validation, VAPID authorization and state.
// Pure apart from node:crypto / jose; no database, no network.
//
// Pushes are sent without a payload: the service worker then reads the live
// campaign from /api/public/push/latest, so a notification always shows the
// server's current, real offer (and no message content needs encrypting).

import { createHash, createPublicKey } from "node:crypto";
import { importJWK, SignJWT } from "jose";

import { PUSH_CONSENT_VERSION, type Lang } from "./topics";

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  language: Lang;
  consentVersion: string;
  sourcePage: string | null;
}

export type PushValidation = { ok: true; value: PushSubscriptionInput } | { ok: false; fieldErrors: Record<string, string> };

const B64URL = /^[A-Za-z0-9_-]+$/;
const PAGE_RE = /^\/[\w\-./]{0,199}$/;

export function validatePushSubscription(raw: unknown): PushValidation {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sub = (body.subscription && typeof body.subscription === "object" ? body.subscription : {}) as Record<string, unknown>;
  const keys = (sub.keys && typeof sub.keys === "object" ? sub.keys : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const endpoint = typeof sub.endpoint === "string" ? sub.endpoint.trim() : "";
  let url: URL | null = null;
  try {
    url = new URL(endpoint);
  } catch {
    url = null;
  }
  if (!url || url.protocol !== "https:" || endpoint.length > 1000 || url.username || url.password) errors.endpoint = "invalid";
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh : "";
  const auth = typeof keys.auth === "string" ? keys.auth : "";
  if (!B64URL.test(p256dh) || p256dh.length > 120 || !B64URL.test(auth) || auth.length > 60) errors.keys = "invalid";
  if (body.consent !== true) errors.consent = "required";
  const consentVersion = typeof body.consentVersion === "string" ? body.consentVersion : "";
  if (consentVersion !== PUSH_CONSENT_VERSION) errors.consentVersion = "stale";

  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
  const page = typeof body.sourcePage === "string" ? body.sourcePage.trim() : "";
  return {
    ok: true,
    value: {
      endpoint,
      keys: { p256dh, auth },
      language: body.language === "en" ? "en" : "fr",
      consentVersion,
      sourcePage: PAGE_RE.test(page) ? page : null,
    },
  };
}

/** Stable lookup key for an endpoint (the endpoint itself is a capability URL). */
export function endpointHash(endpoint: string): string {
  return createHash("sha256").update(`takatak-push:${endpoint}`).digest("hex").slice(0, 40);
}

// ── VAPID (RFC 8292) ────────────────────────────────────────────────────────

export interface VapidKeys {
  /** Uncompressed P-256 public key, base64url (65 bytes). Given to browsers. */
  publicKey: string;
  /** Private scalar d, base64url (32 bytes). Server only. */
  privateKey: string;
  /** mailto: or https: contact for push services. */
  subject: string;
}

/** True when the pair is a well-formed P-256 key pair. */
export function vapidKeysValid(keys: Pick<VapidKeys, "publicKey" | "privateKey">): boolean {
  try {
    const pub = Buffer.from(keys.publicKey, "base64url");
    const d = Buffer.from(keys.privateKey, "base64url");
    if (pub.length !== 65 || pub[0] !== 4 || d.length !== 32) return false;
    createPublicKey({ key: { kty: "EC", crv: "P-256", x: pub.subarray(1, 33).toString("base64url"), y: pub.subarray(33).toString("base64url") }, format: "jwk" });
    return true;
  } catch {
    return false;
  }
}

/** Authorization header for one push service origin, valid 12 hours. */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, now = Date.now()): Promise<string> {
  const pub = Buffer.from(keys.publicKey, "base64url");
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: pub.subarray(1, 33).toString("base64url"),
    y: pub.subarray(33).toString("base64url"),
    d: keys.privateKey,
  };
  const key = await importJWK(jwk, "ES256");
  const jwt = await new SignJWT({ sub: keys.subject })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setAudience(new URL(endpoint).origin)
    .setExpirationTime(Math.floor(now / 1000) + 12 * 3600)
    .sign(key);
  return `vapid t=${jwt}, k=${keys.publicKey}`;
}

// ── State kept with the record ──────────────────────────────────────────────

export interface PushConsentProof {
  version: string;
  text: string;
  language: Lang;
  givenAt: string;
  sourcePage: string | null;
  sourceHash: string;
  method: "own_prompt_then_browser_permission";
}

export interface PushState {
  status: "active" | "stopped";
  endpointHash: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  consents: PushConsentProof[];
  stoppedAt: string | null;
  /** Why it stopped: the person, or the push service said the endpoint is gone. */
  stoppedBy: "person" | "push_service" | null;
  lastSentAt: string | null;
}

export function readPushState(metadata: unknown): PushState | null {
  const meta = (metadata && typeof metadata === "object" ? metadata : {}) as Record<string, unknown>;
  const p = meta.push as Partial<PushState> | undefined;
  if (!p || typeof p !== "object" || !p.status || !p.endpoint) return null;
  return {
    status: p.status,
    endpointHash: p.endpointHash ?? endpointHash(p.endpoint),
    endpoint: p.endpoint,
    keys: p.keys ?? { p256dh: "", auth: "" },
    consents: Array.isArray(p.consents) ? p.consents : [],
    stoppedAt: p.stoppedAt ?? null,
    stoppedBy: p.stoppedBy ?? null,
    lastSentAt: p.lastSentAt ?? null,
  };
}

export function pushWithConsent(prev: PushState | null, sub: PushSubscriptionInput, proof: PushConsentProof): PushState {
  return {
    status: "active",
    endpointHash: endpointHash(sub.endpoint),
    endpoint: sub.endpoint,
    keys: sub.keys,
    consents: [...(prev?.consents ?? []), proof].slice(-20),
    stoppedAt: null,
    stoppedBy: null,
    lastSentAt: prev?.lastSentAt ?? null,
  };
}

export function pushStopped(prev: PushState, by: "person" | "push_service", now: Date): PushState {
  if (prev.status === "stopped") return prev;
  return { ...prev, status: "stopped", stoppedAt: now.toISOString(), stoppedBy: by };
}

/** What a push service answer means for the subscription. */
export function pushOutcome(status: number): "sent" | "gone" | "retry" | "rejected" {
  if (status >= 200 && status < 300) return "sent";
  if (status === 404 || status === 410) return "gone";
  if (status === 429 || status >= 500) return "retry";
  return "rejected";
}
