import "server-only";

import { isAllowedSocialImageUrl } from "@/lib/social/media/remote-image";

const DOWNLOAD_TIMEOUT_MS = 12_000;
const MAX_AVATAR_BYTES = 1_500_000;

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type DownloadedSocialAvatar = {
  bytes: Uint8Array;
  contentType: string;
};

function hasValidImageSignature(
  bytes: Uint8Array,
  contentType: string,
): boolean {
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8;
  }

  if (contentType === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    );
  }

  if (contentType === "image/gif") {
    return (
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46
    );
  }

  if (contentType === "image/webp") {
    return (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }

  return false;
}

export async function downloadSocialAvatar(
  sourceUrl: string,
): Promise<DownloadedSocialAvatar> {
  if (!isAllowedSocialImageUrl(sourceUrl)) {
    throw new Error("Social avatar source URL is not allowed.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    DOWNLOAD_TIMEOUT_MS,
  );

  try {
    const response = await fetch(sourceUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Social avatar download failed with status ${response.status}.`,
      );
    }

    const declaredLength = Number(
      response.headers.get("content-length") ?? "0",
    );

    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_AVATAR_BYTES
    ) {
      throw new Error("Social avatar exceeds the size limit.");
    }

    const contentType = (
      response.headers.get("content-type") ?? ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new Error("Social avatar content type is not allowed.");
    }

    const bytes = new Uint8Array(await response.arrayBuffer());

    if (
      bytes.byteLength === 0 ||
      bytes.byteLength > MAX_AVATAR_BYTES
    ) {
      throw new Error("Social avatar size is invalid.");
    }

    if (!hasValidImageSignature(bytes, contentType)) {
      throw new Error("Social avatar file signature is invalid.");
    }

    return { bytes, contentType };
  } finally {
    clearTimeout(timeout);
  }
}
