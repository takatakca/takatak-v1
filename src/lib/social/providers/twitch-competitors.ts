import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { isTwitchHostedImageUrl } from "@/lib/social/media/remote-image";
import { helix, loadAccessToken } from "@/lib/social/providers/twitch-analytics";

const MAX_COMPETITORS = 100;

export type TwitchCompetitorVideo = {
  title: string;
  publishedOn: string;
  views: number;
  durationSeconds: number;
  url: string | null;
  channel: string;
};

export type TwitchCompetitorRow = {
  ref: string;
  name: string;
  login: string;
  imageUrl: string | null;
  videos: number | null;
  views: number | null;
  durationSeconds: number | null;
  items: TwitchCompetitorVideo[];
};

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function readCount(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  return null;
}

function parseDuration(value: string | null): number {
  if (!value) return 0;
  const hours = Number(/(\d+)h/.exec(value)?.[1] ?? 0);
  const minutes = Number(/(\d+)m/.exec(value)?.[1] ?? 0);
  const seconds = Number(/(\d+)s/.exec(value)?.[1] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function safeTwitchUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return null;
    if (host !== "twitch.tv" && !host.endsWith(".twitch.tv")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function safeImage(value: string | null): string | null {
  if (!value || !isTwitchHostedImageUrl(value)) return null;
  return value;
}

function loginOf(input: string): string {
  return input.trim().replace(/^@/, "").toLowerCase();
}

function hashUser(id: string): string {
  return createHash("sha256").update(`twitch:competitor:${id}`).digest("hex");
}

async function videosForChannel(options: {
  userId: string;
  accessToken: string;
  start: string;
  end: string;
  channel: string;
}): Promise<{
  videos: number | null;
  views: number | null;
  durationSeconds: number | null;
  items: TwitchCompetitorVideo[];
}> {
  const items: TwitchCompetitorVideo[] = [];
  let cursor: string | null = null;
  let confirmed = true;

  for (let page = 0; page < 3; page += 1) {
    const query = new URLSearchParams({
      user_id: options.userId,
      first: "100",
    });
    if (cursor) query.set("after", cursor);
    const result = await helix(`/helix/videos?${query.toString()}`, options.accessToken);
    if (result.status < 200 || result.status >= 300) {
      return { videos: null, views: null, durationSeconds: null, items: [] };
    }
    const data = Array.isArray(result.body.data) ? result.body.data : [];
    let oldest: string | null = null;
    for (const item of data) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
      const record = item as Record<string, unknown>;
      const published = readString(record, "published_at");
      if (!published) continue;
      const day = published.slice(0, 10);
      if (oldest == null || day < oldest) oldest = day;
      if (day < options.start || day > options.end) continue;
      items.push({
        title: readString(record, "title") ?? "Untitled video",
        publishedOn: day,
        views: readCount(record, "view_count") ?? 0,
        durationSeconds: parseDuration(readString(record, "duration")),
        url: safeTwitchUrl(readString(record, "url")),
        channel: options.channel,
      });
    }
    const pagination = result.body.pagination;
    const next =
      typeof pagination === "object" &&
      pagination !== null &&
      !Array.isArray(pagination)
        ? readString(pagination as Record<string, unknown>, "cursor")
        : null;
    if (!next || data.length === 0 || (oldest != null && oldest < options.start)) break;
    cursor = next;
    if (page === 2) confirmed = false;
  }

  if (!confirmed) {
    return { videos: null, views: null, durationSeconds: null, items };
  }
  return {
    videos: items.length,
    views: items.reduce((total, item) => total + item.views, 0),
    durationSeconds: items.reduce((total, item) => total + item.durationSeconds, 0),
    items,
  };
}

export async function listTwitchCompetitors(options: {
  clientId: string;
  connectionId: string;
  businessBrandId: string;
  start: string;
  end: string;
}): Promise<TwitchCompetitorRow[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  const tracks = await prisma.socialCompetitorTrack.findMany({
    where: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      platform: "twitch",
      status: "active",
    },
    orderBy: { createdAt: "asc" },
    select: {
      publicRef: true,
      pageName: true,
      usernameCanonical: true,
      profileImageUrl: true,
      externalPageId: true,
    },
  });

  if (!tracks.length) return [];

  const access = await loadAccessToken({
    clientId: options.clientId,
    connectionId: options.connectionId,
  });

  const rows: TwitchCompetitorRow[] = [];
  for (const track of tracks) {
    const channel = track.pageName ?? track.usernameCanonical ?? "Twitch channel";
    const stats = await videosForChannel({
      userId: track.externalPageId,
      accessToken: access.accessToken,
      start: options.start,
      end: options.end,
      channel,
    });
    rows.push({
      ref: track.publicRef,
      name: channel,
      login: track.usernameCanonical ?? "",
      imageUrl: track.profileImageUrl,
      videos: stats.videos,
      views: stats.views,
      durationSeconds: stats.durationSeconds,
      items: stats.items,
    });
  }
  return rows;
}

export async function addTwitchCompetitor(options: {
  clientId: string;
  connectionId: string;
  businessBrandId: string;
  login: string;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "The social connection database is unavailable.", {
      status: 503,
    });
  }

  const login = loginOf(options.login);
  if (!/^[a-z0-9_]{3,25}$/.test(login)) {
    throw new ServiceError("invalid_input", "Enter a Twitch username.", { status: 400 });
  }

  const activeCount = await prisma.socialCompetitorTrack.count({
    where: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      platform: "twitch",
      status: "active",
    },
  });
  if (activeCount >= MAX_COMPETITORS) {
    throw new ServiceError("invalid_input", "This brand already has 100 Twitch competitors.", {
      status: 400,
    });
  }

  const access = await loadAccessToken({
    clientId: options.clientId,
    connectionId: options.connectionId,
  });
  const lookup = await helix(
    `/helix/users?login=${encodeURIComponent(login)}`,
    access.accessToken,
  );
  if (lookup.status === 401 || lookup.status === 403) {
    throw new ServiceError("forbidden", "Reconnect Twitch before adding a competitor.", {
      status: 401,
    });
  }
  if (lookup.status < 200 || lookup.status >= 300) {
    throw new ServiceError("unavailable", "Twitch could not look up that channel.", {
      status: 502,
    });
  }
  const data = Array.isArray(lookup.body.data) ? lookup.body.data : [];
  const first = data[0];
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    throw new ServiceError("not_found", "Twitch could not find that channel.", { status: 404 });
  }
  const record = first as Record<string, unknown>;
  const userId = readString(record, "id");
  const foundLogin = readString(record, "login");
  if (!userId || !foundLogin) {
    throw new ServiceError("not_found", "Twitch could not find that channel.", { status: 404 });
  }
  if (userId === access.broadcasterId) {
    throw new ServiceError(
      "invalid_input",
      "Add a different channel. This one is already connected.",
      { status: 400 },
    );
  }

  const externalPageIdHash = hashUser(userId);
  const existing = await prisma.socialCompetitorTrack.findFirst({
    where: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      externalPageIdHash,
    },
    select: { id: true, status: true },
  });
  if (existing?.status === "active") {
    throw new ServiceError("conflict", "That competitor is already on this list.", {
      status: 409,
    });
  }

  const profileImageUrl = safeImage(readString(record, "profile_image_url"));
  const pageName = readString(record, "display_name") ?? foundLogin;
  const shared = {
    pageName,
    usernameCanonical: foundLogin,
    profileImageUrl,
    status: "active",
    platform: "twitch",
    availability: "available",
    capabilityStatus: "ready",
    lastSuccessAt: new Date(),
    lastErrorCategory: null,
    lastErrorMessage: null,
    externalPageId: userId,
    externalPageIdHash,
  };

  if (existing) {
    await prisma.socialCompetitorTrack.update({
      where: { id: existing.id },
      data: shared,
    });
    return;
  }

  await prisma.socialCompetitorTrack.create({
    data: {
      ...shared,
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      publicRef: `twc_${randomBytes(12).toString("hex")}`,
    },
  });
}

export async function removeTwitchCompetitor(options: {
  clientId: string;
  businessBrandId: string;
  ref: string;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "The social connection database is unavailable.", {
      status: 503,
    });
  }
  const updated = await prisma.socialCompetitorTrack.updateMany({
    where: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      platform: "twitch",
      publicRef: options.ref,
      status: "active",
    },
    data: { status: "removed" },
  });
  if (updated.count === 0) {
    throw new ServiceError("not_found", "That competitor is not on this list.", { status: 404 });
  }
}
