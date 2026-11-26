import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { normalizeBlueskyHandle, parseBlueskyPublicAccount, type InstagramPublicAccount } from "@/lib/social/instagram-live-stats";

// Bluesky competitors: public accounts a brand follows, read live from the
// public Bluesky API (no token needed). Only the handle and DID are kept; the
// numbers are read live (cached 10 minutes), never stored or estimated.

const PROFILE_URL = "https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile";
const FEED_URL = "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed";
const TIMEOUT_MS = 6_000;
const MAX_COMPETITORS = 50;
const CACHE_TTL_MS = 10 * 60 * 1000;

const cache = new Map<string, { at: number; value: InstagramPublicAccount | null }>();

function db() {
  const prisma = getPrisma();
  if (!prisma) throw new ServiceError("unavailable", "The social connection database is unavailable.", { status: 503 });
  return prisma;
}

async function getJson(url: URL): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store", headers: { accept: "application/json" } });
    return { status: response.status, body: response.ok ? await response.json() : null };
  } catch {
    return { status: 0, body: null };
  } finally {
    clearTimeout(timer);
  }
}

async function lookup(handle: string): Promise<InstagramPublicAccount | null> {
  const hit = cache.get(handle);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const profileUrl = new URL(PROFILE_URL);
  profileUrl.searchParams.set("actor", handle);
  const feedUrl = new URL(FEED_URL);
  feedUrl.searchParams.set("actor", handle);
  feedUrl.searchParams.set("limit", "50");
  feedUrl.searchParams.set("filter", "posts_no_replies");
  const [profile, feed] = await Promise.all([getJson(profileUrl), getJson(feedUrl)]);
  if (profile.status === 0 || profile.status >= 500) {
    throw new ServiceError("unavailable", "Bluesky could not be reached. Try again in a moment.", { status: 502 });
  }
  const account = profile.body ? parseBlueskyPublicAccount(profile.body, feed.body) : null;
  cache.set(handle, { at: Date.now(), value: account });
  if (cache.size > 2000) cache.delete(cache.keys().next().value as string);
  return account;
}

const hashId = (did: string) => createHash("sha256").update(`bluesky:${did}`).digest("hex");

export async function addBlueskyCompetitor(options: { clientId: string; businessBrandId: string; handle: string; ownHandle?: string | null }): Promise<void> {
  const handle = normalizeBlueskyHandle(options.handle);
  if (!handle) throw new ServiceError("invalid_input", "Enter a Bluesky handle, for example @restaurant.bsky.social.", { status: 400 });
  if (options.ownHandle && normalizeBlueskyHandle(options.ownHandle) === handle) {
    throw new ServiceError("invalid_input", "Add a different account. This one is yours.", { status: 400 });
  }
  const prisma = db();
  const activeCount = await prisma.socialCompetitorTrack.count({
    where: { clientId: options.clientId, businessBrandId: options.businessBrandId, platform: "bluesky", status: "active" },
  });
  if (activeCount >= MAX_COMPETITORS) throw new ServiceError("invalid_input", `This brand already follows ${MAX_COMPETITORS} Bluesky competitors.`, { status: 400 });
  const found = await lookup(handle);
  if (!found) throw new ServiceError("not_found", "Bluesky found no account with that handle.", { status: 404 });
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
    platform: "bluesky",
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
    data: { ...shared, clientId: options.clientId, businessBrandId: options.businessBrandId, publicRef: `bsc_${randomBytes(12).toString("hex")}` },
  });
}

export async function removeBlueskyCompetitor(options: { clientId: string; businessBrandId: string; ref: string }): Promise<void> {
  const updated = await db().socialCompetitorTrack.updateMany({
    where: { clientId: options.clientId, businessBrandId: options.businessBrandId, platform: "bluesky", publicRef: options.ref, status: "active" },
    data: { status: "removed" },
  });
  if (updated.count === 0) throw new ServiceError("not_found", "That competitor is not on this list.", { status: 404 });
}

export async function listBlueskyCompetitors(options: { clientId: string; businessBrandId: string }) {
  const tracks = await db().socialCompetitorTrack.findMany({
    where: { clientId: options.clientId, businessBrandId: options.businessBrandId, platform: "bluesky", status: "active" },
    select: { publicRef: true, usernameCanonical: true, externalPageId: true },
    orderBy: { createdAt: "asc" },
    take: MAX_COMPETITORS,
  });
  // The DID stays the same when an account changes its handle.
  const actors = new Map(tracks.map((track) => [track.publicRef, track.externalPageId.startsWith("did:") ? track.externalPageId : track.usernameCanonical ?? ""]));
  const out = tracks.map((track) => ({ ref: track.publicRef, username: track.usernameCanonical ?? "", account: null as InstagramPublicAccount | null }));
  for (let index = 0; index < out.length; index += 5) {
    await Promise.all(
      out.slice(index, index + 5).map(async (row) => {
        const actor = actors.get(row.ref) ?? "";
        if (!actor) return;
        try {
          row.account = await lookup(actor);
        } catch {
          row.account = null;
        }
      }),
    );
  }
  return out;
}
