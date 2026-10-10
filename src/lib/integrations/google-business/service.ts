import "server-only";

// Google Business Profile — per-client OAuth connection, location discovery,
// review import and reply posting through Google's official APIs:
// - OAuth 2.0 + PKCE, scope business.manage
// - Account Management v1, Business Information v1, My Business v4 (reviews)
// Every function takes an optional fetch implementation so the whole flow can
// be exercised against simulated Google responses in QA.

import { triggerLowRatingResponder } from "@/lib/ai-agents/service";
import { getPrisma } from "@/lib/db/prisma";

import {
  connectionAad,
  decryptGrowthValue,
  encryptGrowthValue,
  growthEncryptionConfigured,
  oauthStateAad,
  pkceChallenge,
  randomToken,
  sha256,
} from "./crypto";
import { parseAccounts, parseLocations, parseReviewsPage } from "./parse";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const SCOPE = "https://www.googleapis.com/auth/business.manage";
const STATE_TTL_MS = 10 * 60_000;
const TIMEOUT_MS = 20_000;
const MAX_REVIEW_PAGES = 5;
export const GOOGLE_BUSINESS_CALLBACK_PATH = "/api/integrations/google-business/callback";

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function requirePrisma() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");
  return prisma;
}

export function googleBusinessConfigured(): boolean {
  return (
    env("GOOGLE_BUSINESS_PROFILE_ENABLED") === "true" &&
    Boolean(env("GOOGLE_BUSINESS_PROFILE_CLIENT_ID") && env("GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET")) &&
    growthEncryptionConfigured()
  );
}

function redirectUri(origin: string): string {
  return env("GOOGLE_BUSINESS_PROFILE_REDIRECT_URI") || `${origin}${GOOGLE_BUSINESS_CALLBACK_PATH}`;
}

async function call(fetchImpl: FetchLike, url: string, init: RequestInit = {}): Promise<Response> {
  return fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
}

// ------------------------------------------------------------------- OAuth

/** Creates a single-use, hashed OAuth state bound to this user + workspace and returns Google's consent URL. */
export async function startGoogleBusinessConnect(input: { clientId: string; profileId: string; origin: string }): Promise<string> {
  if (!googleBusinessConfigured()) throw new Error("google_business_not_configured");
  const prisma = requirePrisma();
  const state = randomToken(32);
  const verifier = randomToken(48);
  const row = await prisma.googleBusinessOAuthState.create({
    data: {
      clientId: input.clientId,
      profileId: input.profileId,
      stateHash: sha256(state),
      verifierCiphertext: "pending",
      verifierIv: "pending",
      verifierAuthTag: "pending",
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    },
    select: { id: true },
  });
  const encrypted = encryptGrowthValue(verifier, oauthStateAad(input.clientId, row.id));
  await prisma.googleBusinessOAuthState.update({
    where: { id: row.id },
    data: { verifierCiphertext: encrypted.ciphertext, verifierIv: encrypted.iv, verifierAuthTag: encrypted.authTag, verifierKeyVersion: encrypted.keyVersion },
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env("GOOGLE_BUSINESS_PROFILE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", redirectUri(input.origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", pkceChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export type CallbackResult = { ok: true; locations: number } | { ok: false; reason: string };

/**
 * Completes the OAuth flow. The state must exist, be unexpired, unused, and
 * belong to the same user and workspace that started it.
 */
export async function completeGoogleBusinessConnect(
  input: { state: string; code: string; clientId: string; profileId: string; origin: string },
  fetchImpl: FetchLike = fetch,
): Promise<CallbackResult> {
  if (!googleBusinessConfigured()) return { ok: false, reason: "not_configured" };
  const prisma = requirePrisma();
  const row = await prisma.googleBusinessOAuthState.findUnique({ where: { stateHash: sha256(input.state) } });
  if (!row || row.clientId !== input.clientId || row.profileId !== input.profileId) return { ok: false, reason: "invalid_state" };
  if (row.usedAt || row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired_state" };
  const claimed = await prisma.googleBusinessOAuthState.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) return { ok: false, reason: "expired_state" };

  const verifier = decryptGrowthValue(
    { ciphertext: row.verifierCiphertext, iv: row.verifierIv, authTag: row.verifierAuthTag, keyVersion: row.verifierKeyVersion },
    oauthStateAad(row.clientId, row.id),
  );
  const tokenResponse = await call(fetchImpl, "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      code_verifier: verifier,
      client_id: env("GOOGLE_BUSINESS_PROFILE_CLIENT_ID"),
      client_secret: env("GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET"),
      redirect_uri: redirectUri(input.origin),
    }).toString(),
  });
  if (!tokenResponse.ok) return { ok: false, reason: `token_${tokenResponse.status}` };
  const token = (await tokenResponse.json()) as { refresh_token?: string; access_token?: string; scope?: string };
  if (!token.refresh_token || !token.access_token) return { ok: false, reason: "no_refresh_token" };
  if (token.scope && !token.scope.split(" ").includes(SCOPE)) return { ok: false, reason: "scope_not_granted" };

  const existing = await prisma.googleBusinessConnection.findUnique({ where: { clientId: row.clientId }, select: { id: true } });
  const connectionId = existing?.id ?? crypto.randomUUID();
  const encrypted = encryptGrowthValue(token.refresh_token, connectionAad(row.clientId, connectionId));
  await prisma.googleBusinessConnection.upsert({
    where: { clientId: row.clientId },
    create: {
      id: connectionId,
      clientId: row.clientId,
      status: "active",
      tokenCiphertext: encrypted.ciphertext,
      tokenIv: encrypted.iv,
      tokenAuthTag: encrypted.authTag,
      tokenKeyVersion: encrypted.keyVersion,
      connectedByProfileId: row.profileId,
    },
    update: {
      status: "active",
      tokenCiphertext: encrypted.ciphertext,
      tokenIv: encrypted.iv,
      tokenAuthTag: encrypted.authTag,
      tokenKeyVersion: encrypted.keyVersion,
      connectedByProfileId: row.profileId,
      lastError: null,
    },
  });
  const discovered = await discoverLocations(row.clientId, token.access_token, fetchImpl);
  return discovered.ok ? { ok: true, locations: discovered.count } : { ok: false, reason: discovered.reason };
}

async function accessTokenFor(clientId: string, fetchImpl: FetchLike): Promise<{ ok: true; token: string; connectionId: string } | { ok: false; reason: string }> {
  const prisma = requirePrisma();
  const connection = await prisma.googleBusinessConnection.findUnique({ where: { clientId } });
  if (!connection || connection.status === "revoked") return { ok: false, reason: "not_connected" };
  const refreshToken = decryptGrowthValue(
    { ciphertext: connection.tokenCiphertext, iv: connection.tokenIv, authTag: connection.tokenAuthTag, keyVersion: connection.tokenKeyVersion },
    connectionAad(clientId, connection.id),
  );
  const response = await call(fetchImpl, "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: env("GOOGLE_BUSINESS_PROFILE_CLIENT_ID"),
      client_secret: env("GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET"),
    }).toString(),
  });
  if (!response.ok) {
    const reason = response.status === 400 || response.status === 401 ? "access_revoked" : `token_${response.status}`;
    await prisma.googleBusinessConnection.update({ where: { id: connection.id }, data: { status: "error", lastError: reason } });
    return { ok: false, reason };
  }
  const json = (await response.json()) as { access_token?: string };
  return json.access_token ? { ok: true, token: json.access_token, connectionId: connection.id } : { ok: false, reason: "token_missing" };
}

async function discoverLocations(clientId: string, accessToken: string, fetchImpl: FetchLike): Promise<{ ok: true; count: number } | { ok: false; reason: string }> {
  const prisma = requirePrisma();
  const connection = await prisma.googleBusinessConnection.findUniqueOrThrow({ where: { clientId }, select: { id: true } });
  const headers = { Authorization: `Bearer ${accessToken}` };
  const accountsResponse = await call(fetchImpl, "https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers });
  if (!accountsResponse.ok) return { ok: false, reason: `accounts_${accountsResponse.status}` };
  let count = 0;
  for (const account of parseAccounts(await accountsResponse.json()).slice(0, 20)) {
    const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress&pageSize=100`;
    const res = await call(fetchImpl, url, { headers });
    if (!res.ok) continue;
    for (const loc of parseLocations(await res.json(), account.name)) {
      await prisma.googleBusinessLocation.upsert({
        where: { clientId_resourceName: { clientId, resourceName: loc.resourceName } },
        create: { clientId, connectionId: connection.id, resourceName: loc.resourceName, title: loc.title, address: loc.address },
        update: { connectionId: connection.id, title: loc.title, address: loc.address },
      });
      count += 1;
    }
  }
  return { ok: true, count };
}

// ------------------------------------------------------------------ reviews

export interface SyncResult {
  ok: boolean;
  reason?: string;
  locations: number;
  imported: number;
  updated: number;
  triggered: number;
}

export async function syncGoogleReviews(clientId: string, fetchImpl: FetchLike = fetch): Promise<SyncResult> {
  const prisma = requirePrisma();
  const auth = await accessTokenFor(clientId, fetchImpl);
  if (!auth.ok) return { ok: false, reason: auth.reason, locations: 0, imported: 0, updated: 0, triggered: 0 };
  const locations = await prisma.googleBusinessLocation.findMany({ where: { clientId, syncEnabled: true }, select: { id: true, resourceName: true, title: true } });
  let imported = 0;
  let updated = 0;
  let triggered = 0;
  for (const location of locations) {
    let pageToken: string | null = null;
    for (let page = 0; page < MAX_REVIEW_PAGES; page += 1) {
      const url = new URL(`https://mybusiness.googleapis.com/v4/${location.resourceName}/reviews`);
      url.searchParams.set("pageSize", "50");
      url.searchParams.set("orderBy", "updateTime desc");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const res = await call(fetchImpl, url.toString(), { headers: { Authorization: `Bearer ${auth.token}` } });
      if (!res.ok) break;
      const parsed = parseReviewsPage(await res.json());
      for (const review of parsed.reviews) {
        const existing = await prisma.externalReview.findUnique({
          where: { locationId_externalId: { locationId: location.id, externalId: review.externalId } },
          select: { id: true, externalUpdateAt: true, replyComment: true },
        });
        const data = {
          reviewerName: review.reviewerName,
          rating: review.rating,
          comment: review.comment,
          externalCreateAt: review.createTime,
          externalUpdateAt: review.updateTime,
          replyComment: review.replyComment,
          replyUpdatedAt: review.replyUpdatedAt,
        };
        if (!existing) {
          const created = await prisma.externalReview.create({
            data: { clientId, locationId: location.id, source: "google", externalId: review.externalId, ...data },
            select: { id: true },
          });
          imported += 1;
          if (review.rating <= 3 && !review.replyComment) {
            try {
              const queued = await triggerLowRatingResponder(clientId, {
                responseId: created.id,
                rating: review.rating,
                feedback: review.comment,
                businessName: location.title,
                source: "google",
              });
              if (queued) triggered += 1;
            } catch {
              console.error("[google-business] responder trigger failed");
            }
          }
        } else if (existing.externalUpdateAt.getTime() !== review.updateTime.getTime() || existing.replyComment !== review.replyComment) {
          await prisma.externalReview.update({ where: { id: existing.id }, data });
          updated += 1;
        }
      }
      pageToken = parsed.nextPageToken;
      if (!pageToken) break;
    }
  }
  await prisma.googleBusinessConnection.update({ where: { clientId }, data: { status: "active", lastSyncAt: new Date(), lastError: null } });
  return { ok: true, locations: locations.length, imported, updated, triggered };
}

/** Posts (or replaces) the public reply on a Google review of this client. */
export async function replyToGoogleReview(
  clientId: string,
  externalReviewRowId: string,
  comment: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const text = comment.trim().slice(0, 4000);
  if (!text) return { ok: false, reason: "empty_reply" };
  const prisma = requirePrisma();
  const review = await prisma.externalReview.findFirst({
    where: { id: externalReviewRowId, clientId },
    select: { id: true, externalId: true, location: { select: { resourceName: true } } },
  });
  if (!review) return { ok: false, reason: "not_found" };
  const auth = await accessTokenFor(clientId, fetchImpl);
  if (!auth.ok) return auth;
  const res = await call(fetchImpl, `https://mybusiness.googleapis.com/v4/${review.location.resourceName}/reviews/${encodeURIComponent(review.externalId)}/reply`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ comment: text }),
  });
  if (!res.ok) return { ok: false, reason: `reply_${res.status}` };
  await prisma.externalReview.update({ where: { id: review.id }, data: { replyComment: text, replyUpdatedAt: new Date() } });
  return { ok: true };
}

export async function disconnectGoogleBusiness(clientId: string, fetchImpl: FetchLike = fetch): Promise<boolean> {
  const prisma = requirePrisma();
  const connection = await prisma.googleBusinessConnection.findUnique({ where: { clientId } });
  if (!connection) return false;
  try {
    const refreshToken = decryptGrowthValue(
      { ciphertext: connection.tokenCiphertext, iv: connection.tokenIv, authTag: connection.tokenAuthTag, keyVersion: connection.tokenKeyVersion },
      connectionAad(clientId, connection.id),
    );
    await call(fetchImpl, `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, { method: "POST" });
  } catch {
    // Revocation at Google is best effort; the local token is destroyed regardless.
  }
  await prisma.googleBusinessConnection.update({
    where: { id: connection.id },
    data: { status: "revoked", tokenCiphertext: "revoked", tokenIv: "revoked", tokenAuthTag: "revoked" },
  });
  return true;
}

// --------------------------------------------------------------- dashboard

export interface GoogleBusinessSnapshot {
  configured: boolean;
  connection: { status: string; lastSyncAt: Date | null; lastError: string | null } | null;
  locations: Array<{ id: string; title: string; address: string | null; syncEnabled: boolean; reviewCount: number }>;
  reviews: Array<{
    id: string;
    locationTitle: string;
    reviewerName: string | null;
    rating: number;
    comment: string | null;
    createdAt: Date;
    replyComment: string | null;
    aiDraft: { status: string; text: string } | null;
  }>;
  stats: { total: number; averageRating: number | null; unanswered: number };
}

export async function getGoogleBusinessSnapshot(clientId: string): Promise<GoogleBusinessSnapshot> {
  const prisma = requirePrisma();
  const [connection, locations, reviews, agg, unanswered, runs] = await Promise.all([
    prisma.googleBusinessConnection.findUnique({ where: { clientId }, select: { status: true, lastSyncAt: true, lastError: true } }),
    prisma.googleBusinessLocation.findMany({
      where: { clientId },
      orderBy: { title: "asc" },
      select: { id: true, title: true, address: true, syncEnabled: true, _count: { select: { reviews: true } } },
    }),
    prisma.externalReview.findMany({
      where: { clientId },
      orderBy: { externalCreateAt: "desc" },
      take: 50,
      select: { id: true, reviewerName: true, rating: true, comment: true, externalCreateAt: true, replyComment: true, location: { select: { title: true } } },
    }),
    prisma.externalReview.aggregate({ where: { clientId }, _avg: { rating: true }, _count: { _all: true } }),
    prisma.externalReview.count({ where: { clientId, replyComment: null } }),
    prisma.aiAgentRun.findMany({
      where: { clientId, agentKey: "review_responder", status: { in: ["awaiting_approval", "approved", "executing", "completed"] } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { status: true, input: true, output: true },
    }),
  ]);
  const drafts = new Map<string, { status: string; text: string }>();
  for (const run of runs) {
    const input = (run.input ?? {}) as Record<string, unknown>;
    const output = (run.output ?? {}) as Record<string, unknown>;
    const id = typeof input.reviewResponseId === "string" && input.source === "google" ? input.reviewResponseId : null;
    const text = typeof output.reply === "string" ? output.reply : null;
    if (id && text && !drafts.has(id)) drafts.set(id, { status: run.status, text: text.slice(0, 2000) });
  }
  return {
    configured: googleBusinessConfigured(),
    connection,
    locations: locations.map((l) => ({ id: l.id, title: l.title, address: l.address, syncEnabled: l.syncEnabled, reviewCount: l._count.reviews })),
    reviews: reviews.map((r) => ({
      id: r.id,
      locationTitle: r.location.title,
      reviewerName: r.reviewerName,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.externalCreateAt,
      replyComment: r.replyComment,
      aiDraft: drafts.get(r.id) ?? null,
    })),
    stats: {
      total: agg._count._all,
      averageRating: agg._avg.rating === null ? null : Math.round(agg._avg.rating * 10) / 10,
      unanswered,
    },
  };
}
