import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import type { FetchedProfileImage } from "@/lib/social/media/facebook-picture";
import { loadGoogleAccessToken } from "@/lib/social/providers/google-business-performance";

const MEDIA_API = "https://mybusiness.googleapis.com/v4";
const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 1_500_000;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(
  value: Record<string, unknown> | null,
  key: string,
): string | null {
  const result = value?.[key];
  return typeof result === "string" && result.trim()
    ? result.trim()
    : null;
}

async function fetchImage(
  source: string,
): Promise<FetchedProfileImage | null> {
  let url: URL;

  try {
    url = new URL(source);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "image/*" },
    });

    if (!response.ok) {
      return null;
    }

    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim();

    if (!contentType.toLowerCase().startsWith("image/")) {
      return null;
    }

    const bytes = Buffer.from(await response.arrayBuffer());

    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
      return null;
    }

    return { bytes, contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchGoogleBusinessAccountPicture(options: {
  clientId: string;
  accountId: string;
}): Promise<FetchedProfileImage | null> {
  const prisma = getPrisma();

  if (!prisma) {
    return null;
  }

  const account = await prisma.socialAccount.findFirst({
    where: {
      id: options.accountId,
      clientId: options.clientId,
      platform: "google_business",
      status: "connected",
    },
    select: {
      externalAccountId: true,
      profileImageUrl: true,
      metadata: true,
      providerConnectionId: true,
    },
  });

  if (!account) {
    return null;
  }

  if (account.profileImageUrl) {
    const stored = await fetchImage(account.profileImageUrl);
    if (stored) {
      return stored;
    }
  }

  const locationName = account.externalAccountId?.trim() ?? "";
  const metadata = record(account.metadata);
  const googleAccountName = stringValue(metadata, "googleAccountName");
  const connectionId = account.providerConnectionId;

  if (
    !connectionId ||
    !googleAccountName ||
    !/^accounts\/[^/]+$/.test(googleAccountName) ||
    !/^locations\/[^/]+$/.test(locationName)
  ) {
    return null;
  }

  const accessToken = await loadGoogleAccessToken({
    clientId: options.clientId,
    connectionId,
  });

  const mediaUrl = new URL(
    `${MEDIA_API}/${googleAccountName}/${locationName}/media`,
  );
  mediaUrl.searchParams.set("pageSize", "100");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(mediaUrl, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error("[google-business-picture]", {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
        mediaUrl: mediaUrl.toString(),
      });
      return null;
    }

    const body = record(await response.json().catch(() => null));
    const items = Array.isArray(body?.mediaItems)
      ? body.mediaItems.map(record).filter(Boolean)
      : [];

    const preferred =
      items.find((item) => {
        const association = record(item?.locationAssociation);
        return stringValue(association, "category") === "PROFILE";
      }) ??
      items.find((item) => {
        const association = record(item?.locationAssociation);
        return stringValue(association, "category") === "COVER";
      }) ??
      items[0];

    const imageUrl =
      stringValue(preferred ?? null, "googleUrl") ??
      stringValue(preferred ?? null, "thumbnailUrl") ??
      stringValue(preferred ?? null, "sourceUrl");

    if (!imageUrl) {
      return null;
    }

    return await fetchImage(imageUrl);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
