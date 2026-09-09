import "server-only";

import { ServiceError } from "@/lib/services/service-error";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import { getMetaGraphApiVersion } from "@/lib/social/providers/meta-oauth";
import {
  META_OAUTH_PERMISSION_READ_ENGAGEMENT,
} from "@/lib/social/providers/meta-pages";

const META_GRAPH_HOST = "https://graph.facebook.com";
const TOKEN_REQUEST_TIMEOUT_MS = 15_000;

export const META_OAUTH_PERMISSION_INSTAGRAM_BASIC =
  "instagram_basic" as const;

export const META_INSTAGRAM_PAGE_LINK_FIELDS =
  "instagram_business_account{id,username,name,profile_picture_url}" as const;

export type MetaInstagramErrorCategory =
  | "empty"
  | "permission_required"
  | "authorization_expired"
  | "rate_limited"
  | "temporary"
  | "malformed"
  | "not_found";

export type DiscoveredInstagramAccount = {
  externalAccountId: string;
  handle: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
};

export class MetaInstagramError extends ServiceError {
  readonly category: MetaInstagramErrorCategory;

  constructor(
    category: MetaInstagramErrorCategory,
    message: string,
    options?: { status?: number },
  ) {
    const code =
      category === "authorization_expired" ||
      category === "permission_required"
        ? "forbidden"
        : category === "not_found"
          ? "not_found"
          : category === "empty"
            ? "not_found"
            : category === "malformed"
              ? "invalid_input"
              : "unavailable";

    super(code, message, options);
    this.name = "MetaInstagramError";
    this.category = category;
  }
}

function graphUrl(path: string): URL {
  const version = getMetaGraphApiVersion();
  const url = new URL(`${META_GRAPH_HOST}/${version}${path}`);

  if (url.origin !== META_GRAPH_HOST) {
    throw new MetaInstagramError(
      "temporary",
      "The Facebook Graph host is invalid.",
      { status: 503 },
    );
  }

  return url;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function classifyMetaError(
  status: number,
  record: Record<string, unknown>,
): MetaInstagramErrorCategory {
  const error =
    typeof record.error === "object" &&
    record.error !== null &&
    !Array.isArray(record.error)
      ? (record.error as Record<string, unknown>)
      : null;

  const code = typeof error?.code === "number" ? error.code : null;
  const subcode =
    typeof error?.error_subcode === "number"
      ? error.error_subcode
      : null;

  if (status === 429 || code === 4 || code === 17 || code === 32) {
    return "rate_limited";
  }

  if (
    status === 401 ||
    code === 190 ||
    code === 102 ||
    subcode === 463 ||
    subcode === 467
  ) {
    return "authorization_expired";
  }

  if (status === 403 || code === 10 || code === 200 || code === 294) {
    return "permission_required";
  }

  if (status === 404) {
    return "not_found";
  }

  if (status >= 500) {
    return "temporary";
  }

  return "temporary";
}

async function fetchMetaJson(
  url: URL,
  stage: string,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TOKEN_REQUEST_TIMEOUT_MS,
  );

  let response: Response;

  try {
    response = await fetch(url.toString(), {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new MetaInstagramError(
        "temporary",
        "Instagram discovery timed out. You can retry.",
        { status: 503 },
      );
    }

    throw new MetaInstagramError(
      "temporary",
      "Instagram discovery could not be completed. You can retry.",
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new MetaInstagramError(
      "malformed",
      "Facebook returned an unexpected Instagram discovery response.",
      { status: 502 },
    );
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new MetaInstagramError(
      "malformed",
      "Facebook returned an invalid Instagram discovery response.",
      { status: 502 },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    throw new MetaInstagramError(
      "malformed",
      "Facebook returned an incomplete Instagram discovery response.",
      { status: 502 },
    );
  }

  const record = body as Record<string, unknown>;

  if (!response.ok || record.error) {
    const category = classifyMetaError(response.status, record);

    logSocialOAuthEvent("meta-instagram", {
      stage,
      outcome: category,
      provider: "meta",
    });

    const message =
      category === "authorization_expired"
        ? "Facebook authorization expired. Reconnect to continue."
        : category === "permission_required"
          ? "Instagram permissions are missing. Reconnect Facebook and grant Instagram access."
          : category === "rate_limited"
            ? "Facebook rate-limited Instagram discovery. Wait a moment and retry."
            : category === "not_found"
              ? "The linked Instagram account is no longer available through this Page."
              : "Instagram discovery failed temporarily. You can retry.";

    throw new MetaInstagramError(category, message, {
      status:
        category === "authorization_expired" ||
        category === "permission_required"
          ? 403
          : category === "not_found"
            ? 404
            : 503,
    });
  }

  return record;
}

/** Pure mapper — never returns tokens or Facebook Page IDs. */
export function mapLinkedInstagramFromPageRecord(
  raw: Record<string, unknown>,
): DiscoveredInstagramAccount | null {
  const nested = raw.instagram_business_account;

  if (
    typeof nested !== "object" ||
    nested === null ||
    Array.isArray(nested)
  ) {
    return null;
  }

  const record = nested as Record<string, unknown>;
  const id = readString(record, "id");

  if (!id) {
    return null;
  }

  const handle = readString(record, "username");
  const name = readString(record, "name");

  return {
    externalAccountId: id,
    handle,
    displayName: name || handle,
    profileImageUrl: readString(record, "profile_picture_url"),
  };
}

export function instagramConnectionEligible(
  grantedPermissions: readonly string[],
): boolean {
  return (
    grantedPermissions.includes(META_OAUTH_PERMISSION_INSTAGRAM_BASIC) &&
    grantedPermissions.includes(META_OAUTH_PERMISSION_READ_ENGAGEMENT)
  );
}

/**
 * Fetch the Instagram professional account linked to a Facebook Page.
 * Uses the Page access token. Never logs tokens or IDs.
 */
export async function fetchLinkedInstagramForFacebookPage(options: {
  pageAccessToken: string;
  externalPageId: string;
}): Promise<DiscoveredInstagramAccount> {
  if (!options.pageAccessToken.trim()) {
    throw new MetaInstagramError(
      "permission_required",
      "Facebook did not return a usable Page access token for Instagram.",
      { status: 403 },
    );
  }

  const pageId = options.externalPageId.trim();

  if (!pageId || !/^\d+$/.test(pageId)) {
    throw new MetaInstagramError(
      "malformed",
      "The Facebook Page could not be used for Instagram discovery.",
      { status: 400 },
    );
  }

  const url = graphUrl(`/${encodeURIComponent(pageId)}`);
  url.searchParams.set("fields", META_INSTAGRAM_PAGE_LINK_FIELDS);
  url.searchParams.set("access_token", options.pageAccessToken);

  const record = await fetchMetaJson(url, "discover_instagram");
  const mapped = mapLinkedInstagramFromPageRecord(record);

  if (!mapped) {
    throw new MetaInstagramError(
      "empty",
      "This Facebook Page has no Instagram professional account linked. Link Instagram to the Page in Meta Business Suite, then try again.",
      { status: 404 },
    );
  }

  return mapped;
}
