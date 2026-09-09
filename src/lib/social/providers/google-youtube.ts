import "server-only";

import { ServiceError } from "@/lib/services/service-error";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";

const YOUTUBE_API_HOST = "https://www.googleapis.com";
const REQUEST_TIMEOUT_MS = 15_000;

export type YoutubeChannelRecord = {
  externalAccountId: string;
  displayName: string;
  handle: string | null;
  profileImageUrl: string | null;
};

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

export async function listYoutubeChannelsForAccessToken(options: {
  accessToken: string;
}): Promise<YoutubeChannelRecord[]> {
  const url = new URL(`${YOUTUBE_API_HOST}/youtube/v3/channels`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("mine", "true");
  url.searchParams.set("maxResults", "50");

  if (url.origin !== YOUTUBE_API_HOST) {
    throw new ServiceError(
      "unavailable",
      "YouTube could not be reached.",
      { status: 503 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${options.accessToken}`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ServiceError(
        "unavailable",
        "YouTube timed out while loading channels. You can retry.",
        { status: 503 },
      );
    }
    throw new ServiceError(
      "unavailable",
      "YouTube could not be reached. You can retry.",
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ServiceError(
      "unavailable",
      "YouTube returned an unexpected channel response.",
      { status: 502 },
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ServiceError(
      "unavailable",
      "YouTube returned an invalid channel response.",
      { status: 502 },
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ServiceError(
      "unavailable",
      "YouTube returned an incomplete channel response.",
      { status: 502 },
    );
  }

  const record = body as Record<string, unknown>;

  if (!response.ok || record.error) {
    const error =
      typeof record.error === "object" && record.error !== null
        ? (record.error as Record<string, unknown>)
        : null;
    const status = readString(error ?? {}, "status");
    const reason =
      Array.isArray(error?.errors) &&
      error.errors[0] &&
      typeof error.errors[0] === "object"
        ? readString(error.errors[0] as Record<string, unknown>, "reason")
        : null;

    logSocialOAuthEvent("google-youtube", {
      stage: "list_channels",
      outcome: "failed",
      provider: "google",
    });

    if (status === "PERMISSION_DENIED" || reason === "accessNotConfigured") {
      throw new ServiceError(
        "unavailable",
        "YouTube Data API is not enabled for this Google Cloud project.",
        { status: 503 },
      );
    }

    throw new ServiceError(
      "unavailable",
      "YouTube channels could not be loaded. You can retry.",
      { status: 503 },
    );
  }

  const items = Array.isArray(record.items) ? record.items : [];
  const channels: YoutubeChannelRecord[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const id = readString(row, "id");
    if (!id) continue;
    const snippet =
      typeof row.snippet === "object" &&
      row.snippet !== null &&
      !Array.isArray(row.snippet)
        ? (row.snippet as Record<string, unknown>)
        : {};
    const thumbnails =
      typeof snippet.thumbnails === "object" &&
      snippet.thumbnails !== null &&
      !Array.isArray(snippet.thumbnails)
        ? (snippet.thumbnails as Record<string, unknown>)
        : {};
    const defaultThumb =
      typeof thumbnails.default === "object" &&
      thumbnails.default !== null &&
      !Array.isArray(thumbnails.default)
        ? (thumbnails.default as Record<string, unknown>)
        : {};
    const mediumThumb =
      typeof thumbnails.medium === "object" &&
      thumbnails.medium !== null &&
      !Array.isArray(thumbnails.medium)
        ? (thumbnails.medium as Record<string, unknown>)
        : {};
    const customUrl = readString(snippet, "customUrl");
    const title = readString(snippet, "title") || "YouTube channel";
    channels.push({
      externalAccountId: id,
      displayName: title,
      handle: customUrl,
      profileImageUrl:
        readString(mediumThumb, "url") || readString(defaultThumb, "url"),
    });
  }

  return channels;
}
