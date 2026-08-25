import "server-only";

import https from "node:https";

import { getPrisma } from "@/lib/db/prisma";
import { isAllowedSocialImageUrl } from "@/lib/social/media/remote-image";
import { getMetaGraphApiVersion } from "@/lib/social/providers/meta-oauth";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 5;

export type FetchedProfileImage = {
  bytes: Buffer;
  contentType: string;
};

function shouldRelaxTls(): boolean {
  return (
    process.env.PGSSL_REJECT_UNAUTHORIZED === "false" ||
    (process.env.HOME ?? "").includes("/home/takatakc") ||
    process.env.LSNODE_ROOT !== undefined
  );
}

function fetchImageBytes(
  urlString: string,
  redirects = 0,
): Promise<FetchedProfileImage | null> {
  return new Promise((resolve) => {
    if (redirects > MAX_REDIRECTS) {
      resolve(null);
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(urlString);
    } catch {
      resolve(null);
      return;
    }

    if (parsed.protocol !== "https:") {
      resolve(null);
      return;
    }

    const req = https.get(
      parsed,
      {
        rejectUnauthorized: !shouldRelaxTls(),
        headers: { Accept: "image/*" },
        timeout: FETCH_TIMEOUT_MS,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          const next = new URL(res.headers.location, parsed).toString();
          res.resume();
          void fetchImageBytes(next, redirects + 1).then(resolve);
          return;
        }

        if (status < 200 || status >= 300) {
          res.resume();
          resolve(null);
          return;
        }

        const contentType = String(res.headers["content-type"] ?? "image/jpeg")
          .split(";")[0]
          .trim();
        if (!contentType.toLowerCase().startsWith("image/")) {
          res.resume();
          resolve(null);
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy();
            resolve(null);
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          const bytes = Buffer.concat(chunks);
          if (bytes.byteLength === 0) {
            resolve(null);
            return;
          }
          resolve({ bytes, contentType: contentType || "image/jpeg" });
        });
        res.on("error", () => resolve(null));
      },
    );

    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
    req.on("error", () => resolve(null));
  });
}

function graphPictureUrl(pageId: string, accessToken?: string): string {
  const version = getMetaGraphApiVersion();
  const url = new URL(`https://graph.facebook.com/${version}/${pageId}/picture`);
  url.searchParams.set("type", "large");
  url.searchParams.set("redirect", "true");
  if (accessToken) {
    url.searchParams.set("access_token", accessToken);
  }
  return url.toString();
}

function metaAppAccessToken(): string | null {
  const appId = process.env.META_APP_ID?.trim();
  const secret = process.env.META_APP_SECRET?.trim();
  if (!appId || !secret) return null;
  return `${appId}|${secret}`;
}

export function publicGraphPictureUrl(pageId: string): string {
  return graphPictureUrl(pageId);
}

export async function fetchFacebookAccountPicture(options: {
  clientId: string;
  accountId: string;
}): Promise<FetchedProfileImage | { redirectTo: string } | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  const account = await prisma.socialAccount.findFirst({
    where: {
      id: options.accountId,
      clientId: options.clientId,
    },
    select: {
      platform: true,
      externalAccountId: true,
      profileImageUrl: true,
    },
  });

  if (!account) return null;

  const pageId = account.externalAccountId?.trim() || null;
  const appToken = metaAppAccessToken();

  if (account.platform === "facebook" && pageId && appToken) {
    const fromGraph = await fetchImageBytes(graphPictureUrl(pageId, appToken));
    if (fromGraph) return fromGraph;
  }

  if (isAllowedSocialImageUrl(account.profileImageUrl)) {
    const fromStored = await fetchImageBytes(account.profileImageUrl!);
    if (fromStored) return fromStored;
  }

  if (account.platform === "facebook" && pageId) {
    return { redirectTo: publicGraphPictureUrl(pageId) };
  }

  return null;
}
