import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import {
  normalizeInstagramUsername,
  parseBusinessDiscovery,
  type InstagramPublicAccount,
} from "@/lib/social/instagram-live-stats";
import { graphGet, loadInstagramCredential, type InstagramCredential } from "@/lib/social/providers/instagram-live-fetch";

// Instagram competitors: public professional accounts a brand follows, read
// live through Meta's Business Discovery with the brand's own Facebook-linked
// Instagram connection. Only the username and Instagram's numeric id are kept;
// numbers are read live (cached 10 minutes), never stored or estimated.

const MAX_COMPETITORS = 50;
const CACHE_TTL_MS = 10 * 60 * 1000;
const DISCOVERY_FIELDS = "id,username,name,followers_count,media_count,media.limit(25){id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count}";

const cache = new Map<string, { at: number; value: InstagramPublicAccount | null }>();

function db() {
  const prisma = getPrisma();
  if (!prisma) throw new ServiceError("unavailable", "The social connection database is unavailable.", { status: 503 });
  return prisma;
}

async function competitorCredential(clientId: string, socialAccountId: string): Promise<InstagramCredential> {
  const credential = await loadInstagramCredential({ clientId, socialAccountId });
  if (!credential) throw new ServiceError("forbidden", "Reconnect Instagram before adding a competitor.", { status: 401 });
  if (credential.host !== "https://graph.facebook.com") {
    throw new ServiceError(
      "invalid_input",
      "Instagram lets TAKATAK read other accounts only when your Instagram is linked through your Facebook Page.",
      { status: 400 },
    );
  }
  return credential;
}

async function discover(credential: InstagramCredential, username: string): Promise<InstagramPublicAccount | null | "denied"> {
  const key = `${credential.igUserId}:${username}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const result = await graphGet(credential, credential.igUserId, {
    fields: `business_discovery.username(${username}){${DISCOVERY_FIELDS}}`,
  });
  if (!result.ok) {
    if (result.status === 401 || result.status === 403 || result.code === 10 || result.code === 200) return "denied";
    // Code 110 / 100: no such username, or a personal (non-professional) account.
    if (result.status === 400 || result.status === 404) {
      cache.set(key, { at: Date.now(), value: null });
      return null;
    }
    throw new ServiceError("unavailable", "Instagram could not be reached. Try again in a moment.", { status: 502 });
  }
  const account = parseBusinessDiscovery(result.body);
  cache.set(key, { at: Date.now(), value: account });
  if (cache.size > 2000) cache.delete(cache.keys().next().value as string);
  return account;
}

const hashId = (id: string) => createHash("sha256").update(`instagram:${id}`).digest("hex");

export async function addInstagramCompetitor(options: {
  clientId: string;
  businessBrandId: string;
  socialAccountId: string;
  username: string;
}): Promise<void> {
  const username = normalizeInstagramUsername(options.username);
  if (!username) throw new ServiceError("invalid_input", "Enter an Instagram username, for example @restaurant.", { status: 400 });
  const prisma = db();
  const activeCount = await prisma.socialCompetitorTrack.count({
    where: { clientId: options.clientId, businessBrandId: options.businessBrandId, platform: "instagram", status: "active" },
  });
  if (activeCount >= MAX_COMPETITORS) {
    throw new ServiceError("invalid_input", `This brand already follows ${MAX_COMPETITORS} Instagram competitors.`, { status: 400 });
  }
  const credential = await competitorCredential(options.clientId, options.socialAccountId);
  const found = await discover(credential, username);
  if (found === "denied") throw new ServiceError("forbidden", "Reconnect Instagram through your Facebook Page to add competitors.", { status: 401 });
  if (!found) {
    throw new ServiceError("not_found", "Instagram found no professional account with that username (personal accounts cannot be followed).", { status: 404 });
  }
  if (found.id === credential.igUserId) throw new ServiceError("invalid_input", "Add a different account. This one is yours.", { status: 400 });

  const externalPageIdHash = hashId(found.id);
  const existing = await prisma.socialCompetitorTrack.findFirst({
    where: { clientId: options.clientId, businessBrandId: options.businessBrandId, externalPageIdHash },
    select: { id: true, status: true },
  });
  if (existing?.status === "active") throw new ServiceError("conflict", "That competitor is already on this list.", { status: 409 });
  const shared = {
    pageName: found.name ?? found.username,
    usernameCanonical: found.username,
    profileImageUrl: null,
    status: "active",
    platform: "instagram",
    availability: "available",
    capabilityStatus: "ready",
    lastSuccessAt: new Date(),
    lastErrorCategory: null,
    lastErrorMessage: null,
    externalPageId: found.id,
    externalPageIdHash,
  };
  if (existing) {
    await prisma.socialCompetitorTrack.update({ where: { id: existing.id }, data: shared });
    return;
  }
  await prisma.socialCompetitorTrack.create({
    data: { ...shared, clientId: options.clientId, businessBrandId: options.businessBrandId, publicRef: `igc_${randomBytes(12).toString("hex")}` },
  });
}

export async function removeInstagramCompetitor(options: { clientId: string; businessBrandId: string; ref: string }): Promise<void> {
  const updated = await db().socialCompetitorTrack.updateMany({
    where: { clientId: options.clientId, businessBrandId: options.businessBrandId, platform: "instagram", publicRef: options.ref, status: "active" },
    data: { status: "removed" },
  });
  if (updated.count === 0) throw new ServiceError("not_found", "That competitor is not on this list.", { status: 404 });
}

export interface InstagramCompetitorLive {
  ref: string;
  username: string;
  /** null when Instagram did not answer for this account right now. */
  account: InstagramPublicAccount | null;
}

/** The brand's competitors with their live public numbers (5 lookups at a time). */
export async function listInstagramCompetitors(options: {
  clientId: string;
  businessBrandId: string;
  socialAccountId: string;
}): Promise<InstagramCompetitorLive[]> {
  const tracks = await db().socialCompetitorTrack.findMany({
    where: { clientId: options.clientId, businessBrandId: options.businessBrandId, platform: "instagram", status: "active" },
    select: { publicRef: true, usernameCanonical: true },
    orderBy: { createdAt: "asc" },
    take: MAX_COMPETITORS,
  });
  if (!tracks.length) return [];
  const credential = await loadInstagramCredential({ clientId: options.clientId, socialAccountId: options.socialAccountId });
  const out: InstagramCompetitorLive[] = tracks.map((track) => ({ ref: track.publicRef, username: track.usernameCanonical ?? "", account: null }));
  if (!credential || credential.host !== "https://graph.facebook.com") return out;
  for (let index = 0; index < out.length; index += 5) {
    await Promise.all(
      out.slice(index, index + 5).map(async (row) => {
        if (!row.username) return;
        try {
          const found = await discover(credential, row.username);
          row.account = found && found !== "denied" ? found : null;
        } catch {
          row.account = null;
        }
      }),
    );
  }
  return out;
}
