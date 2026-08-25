import "server-only";

import { ServiceError } from "@/lib/services/service-error";
import {
  getMetaGraphApiVersion,
} from "@/lib/social/providers/meta-oauth";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";

const META_GRAPH_HOST = "https://graph.facebook.com";
const TOKEN_REQUEST_TIMEOUT_MS = 15_000;
/** Safety cap on paginated /me/accounts requests. */
export const META_PAGES_MAX_PAGES = 10;
export const META_PAGES_PAGE_SIZE = 50;

/**
 * Fields requested from Meta for Page selection UI + persistence.
 * access_token is used only server-side during selection; never returned to browsers.
 */
export const META_PAGE_DISCOVERY_FIELDS = [
  "id",
  "name",
  "picture{url}",
  "category",
  "access_token",
  "tasks",
] as const;

/**
 * Meta Graph Page tasks (v21.x / Pages API overview).
 *
 * MANAGE = assign and manage Page tasks / Page settings — NOT a substitute
 * for CREATE_CONTENT (publish) or MODERATE (comment moderation).
 * CREATE_CONTENT = publish content as the Page.
 * MODERATE = respond to / delete comments as the Page.
 * ANALYZE = view Page insights.
 */
export const META_PAGE_TASK_CREATE_CONTENT = "CREATE_CONTENT" as const;
export const META_PAGE_TASK_MODERATE = "MODERATE" as const;
export const META_PAGE_TASK_MANAGE = "MANAGE" as const;
export const META_PAGE_TASK_ANALYZE = "ANALYZE" as const;

/** OAuth permissions required for Takatak Facebook Page features. */
export const META_OAUTH_PERMISSION_READ_ENGAGEMENT =
  "pages_read_engagement" as const;
export const META_OAUTH_PERMISSION_READ_INSIGHTS =
  "read_insights" as const;
export const META_OAUTH_PERMISSION_PUBLISH =
  "pages_manage_posts" as const;
export const META_OAUTH_PERMISSION_MODERATE =
  "pages_manage_engagement" as const;

/**
 * Permission → feature mapping (Graph API version from getMetaGraphApiVersion):
 * - Connection (Step 5): Page token + pages_read_engagement
 * - Page analytics sync: pages_read_engagement + read_insights (+ media-view metrics)
 * - Publishing: pages_manage_posts + CREATE_CONTENT task + Page token
 * - Moderation: pages_manage_engagement + MODERATE task + Page token
 * - Page settings (future): MANAGE task (not claimed as publish/moderate)
 *
 * Step 5 start scopes today: public_profile, pages_show_list,
 * pages_read_engagement, read_insights.
 * Connection eligibility still gates on Page token + pages_read_engagement.
 * Analytics additionally needs read_insights on the issued token.
 */
export const META_PAGE_FEATURE_PERMISSION_MAP = {
  connection: {
    oauthPermission: META_OAUTH_PERMISSION_READ_ENGAGEMENT,
    pageTasks: [] as string[],
    requiresPageToken: true,
  },
  readEngagement: {
    oauthPermission: META_OAUTH_PERMISSION_READ_ENGAGEMENT,
    pageTasks: [] as string[],
  },
  readInsights: {
    oauthPermission: META_OAUTH_PERMISSION_READ_INSIGHTS,
    pageTasks: [META_PAGE_TASK_ANALYZE] as string[],
  },
  publish: {
    oauthPermission: META_OAUTH_PERMISSION_PUBLISH,
    pageTasks: [META_PAGE_TASK_CREATE_CONTENT],
  },
  moderate: {
    oauthPermission: META_OAUTH_PERMISSION_MODERATE,
    pageTasks: [META_PAGE_TASK_MODERATE],
  },
} as const;

/** @deprecated Use explicit task constants; kept for field-list docs. */
export const META_PAGE_REQUIRED_TASKS = [
  META_PAGE_TASK_MANAGE,
  META_PAGE_TASK_CREATE_CONTENT,
  META_PAGE_TASK_MODERATE,
] as const;

export type FacebookPageCapabilityClass =
  | "full_management"
  | "publishing_capable"
  | "moderation_only"
  | "engagement_only"
  | "unverified"
  | "insufficient";

export type FacebookPageCapabilityAssessment = {
  classification: FacebookPageCapabilityClass;
  hasPageToken: boolean;
  /**
   * Independent of publish/moderate.
   * True when Takatak may connect this Page for identity/engagement under
   * current product support: live Page credential + pages_read_engagement.
   */
  connectionEligible: boolean;
  /** pages_read_engagement granted + Page token verified. */
  canReadEngagement: boolean;
  /** pages_manage_posts granted + CREATE_CONTENT task + Page token. */
  canPublish: boolean;
  /** pages_manage_engagement granted + MODERATE task + Page token. */
  canModerate: boolean;
  /**
   * UI/API alias for connectionEligible (workspace duplicate checks applied
   * separately in discovery). Not implied by publish/moderate alone.
   */
  selectable: boolean;
  /** Every capability Takatak claims is presently verified. */
  fullyManageable: boolean;
  limitationLabel: string | null;
  tasks: string[];
  grantedPermissions: string[];
};

function hasPermission(
  granted: readonly string[],
  permission: string,
): boolean {
  return granted.includes(permission);
}

function hasTask(
  tasks: readonly string[],
  task: string,
): boolean {
  return tasks.includes(task);
}

/**
 * Classify Page capabilities from live Page tasks AND granted OAuth
 * permissions.
 *
 * connectionEligible is independent of publishing and moderation:
 *   live Page access token AND pages_read_engagement.
 *
 * canPublish / canModerate require their own permission+task pairs.
 * MANAGE is Page-settings administration only (Meta Pages API overview).
 */
export function classifyFacebookPageCapability(
  page: Pick<
    { tasks: string[]; pageAccessToken: string | null },
    "tasks" | "pageAccessToken"
  >,
  grantedPermissions: readonly string[] = [],
): FacebookPageCapabilityAssessment {
  const tasks = page.tasks;
  const granted = [...grantedPermissions];
  const hasPageToken = Boolean(page.pageAccessToken);

  const canReadEngagement =
    hasPageToken &&
    hasPermission(granted, META_OAUTH_PERMISSION_READ_ENGAGEMENT);

  /** Step 5 connection gate — not publish/moderate. */
  const connectionEligible = canReadEngagement;

  const canPublish =
    hasPageToken &&
    hasPermission(granted, META_OAUTH_PERMISSION_PUBLISH) &&
    hasTask(tasks, META_PAGE_TASK_CREATE_CONTENT);

  const canModerate =
    hasPageToken &&
    hasPermission(granted, META_OAUTH_PERMISSION_MODERATE) &&
    hasTask(tasks, META_PAGE_TASK_MODERATE);

  const fullyManageable =
    connectionEligible && canPublish && canModerate;

  if (!hasPageToken) {
    return {
      classification: "insufficient",
      hasPageToken: false,
      connectionEligible: false,
      canReadEngagement: false,
      canPublish: false,
      canModerate: false,
      selectable: false,
      fullyManageable: false,
      limitationLabel: "Insufficient Page access",
      tasks,
      grantedPermissions: granted,
    };
  }

  if (!connectionEligible) {
    return {
      classification: "unverified",
      hasPageToken: true,
      connectionEligible: false,
      canReadEngagement: false,
      canPublish,
      canModerate,
      selectable: false,
      fullyManageable: false,
      limitationLabel:
        "Not eligible to connect — pages_read_engagement is required",
      tasks,
      grantedPermissions: granted,
    };
  }

  // connectionEligible === true from here
  if (fullyManageable) {
    return {
      classification: "full_management",
      hasPageToken: true,
      connectionEligible: true,
      canReadEngagement: true,
      canPublish: true,
      canModerate: true,
      selectable: true,
      fullyManageable: true,
      limitationLabel: null,
      tasks,
      grantedPermissions: granted,
    };
  }

  if (canPublish && !canModerate) {
    return {
      classification: "publishing_capable",
      hasPageToken: true,
      connectionEligible: true,
      canReadEngagement: true,
      canPublish: true,
      canModerate: false,
      selectable: true,
      fullyManageable: false,
      limitationLabel:
        "Connected with publishing — moderation requires pages_manage_engagement and MODERATE",
      tasks,
      grantedPermissions: granted,
    };
  }

  if (canModerate && !canPublish) {
    return {
      classification: "moderation_only",
      hasPageToken: true,
      connectionEligible: true,
      canReadEngagement: true,
      canPublish: false,
      canModerate: true,
      selectable: true,
      fullyManageable: false,
      limitationLabel:
        "Connected with moderation — publishing requires pages_manage_posts and CREATE_CONTENT",
      tasks,
      grantedPermissions: granted,
    };
  }

  // Current Step 5 path: token + pages_read_engagement, no publish/moderate.
  return {
    classification: "engagement_only",
    hasPageToken: true,
    connectionEligible: true,
    canReadEngagement: true,
    canPublish: false,
    canModerate: false,
    selectable: true,
    fullyManageable: false,
    limitationLabel:
      "Eligible to connect for identity and engagement — publishing and moderation are not available",
    tasks,
    grantedPermissions: granted,
  };
}

/**
 * Connection eligibility (Step 5). Alias of connectionEligible.
 */
export function pageHasManageCapability(
  page: Pick<
    { tasks: string[]; pageAccessToken: string | null },
    "tasks" | "pageAccessToken"
  >,
  grantedPermissions: readonly string[] = [],
): boolean {
  return classifyFacebookPageCapability(page, grantedPermissions)
    .connectionEligible;
}

export function pageIsFullyManageable(
  page: Pick<
    { tasks: string[]; pageAccessToken: string | null },
    "tasks" | "pageAccessToken"
  >,
  grantedPermissions: readonly string[] = [],
): boolean {
  return classifyFacebookPageCapability(page, grantedPermissions)
    .fullyManageable;
}

export type MetaPageDiscoveryErrorCategory =
  | "empty"
  | "permission_required"
  | "authorization_expired"
  | "rate_limited"
  | "temporary"
  | "malformed"
  | "not_found";

export type DiscoveredMetaPage = {
  externalPageId: string;
  name: string;
  category: string | null;
  profileImageUrl: string | null;
  /** Present only in server memory — never serialized to clients. */
  pageAccessToken: string | null;
  tasks: string[];
};

export class MetaPageDiscoveryError extends ServiceError {
  readonly category: MetaPageDiscoveryErrorCategory;

  constructor(
    category: MetaPageDiscoveryErrorCategory,
    message: string,
    options?: { status?: number },
  ) {
    const code =
      category === "authorization_expired" ||
      category === "permission_required"
        ? "forbidden"
        : category === "not_found"
          ? "not_found"
          : category === "malformed"
            ? "invalid_input"
            : "unavailable";

    super(code, message, options);
    this.name = "MetaPageDiscoveryError";
    this.category = category;
  }
}

function graphUrl(path: string): URL {
  const version = getMetaGraphApiVersion();
  const url = new URL(`${META_GRAPH_HOST}/${version}${path}`);

  if (url.origin !== META_GRAPH_HOST) {
    throw new MetaPageDiscoveryError(
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
): MetaPageDiscoveryErrorCategory {
  const error =
    typeof record.error === "object" &&
    record.error !== null &&
    !Array.isArray(record.error)
      ? (record.error as Record<string, unknown>)
      : null;

  const code =
    typeof error?.code === "number" ? error.code : null;
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

  if (status >= 500) {
    return "temporary";
  }

  return "temporary";
}

async function fetchMetaJson(
  url: URL,
  stage: string,
): Promise<Record<string, unknown>> {
  let response: Response | undefined;
  let lastError: unknown;

  // One retry for transient socket closes (common on Meta/Cloudflare edges).
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      TOKEN_REQUEST_TIMEOUT_MS,
    );

    try {
      response = await fetch(url.toString(), {
        method: "GET",
        redirect: "error",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        throw new MetaPageDiscoveryError(
          "temporary",
          "Facebook Page discovery timed out. You can retry.",
          { status: 503 },
        );
      }
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!response) {
    void lastError;
    throw new MetaPageDiscoveryError(
      "temporary",
      "Facebook Page discovery could not be completed. You can retry.",
      { status: 503 },
    );
  }

  const contentType =
    response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new MetaPageDiscoveryError(
      "malformed",
      "Facebook returned an unexpected Page discovery response.",
      { status: 502 },
    );
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new MetaPageDiscoveryError(
      "malformed",
      "Facebook returned an invalid Page discovery response.",
      { status: 502 },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    throw new MetaPageDiscoveryError(
      "malformed",
      "Facebook returned an incomplete Page discovery response.",
      { status: 502 },
    );
  }

  const record = body as Record<string, unknown>;

  if (!response.ok || record.error) {
    const category = classifyMetaError(
      response.status,
      record,
    );

    logSocialOAuthEvent("meta-pages", {
      stage,
      outcome: category,
      provider: "meta",
    });

    const message =
      category === "authorization_expired"
        ? "Facebook authorization expired. Reconnect to continue."
        : category === "permission_required"
          ? "Facebook Page permissions are missing. Reauthorize with Page access."
          : category === "rate_limited"
            ? "Facebook rate-limited Page discovery. Wait a moment and retry."
            : "Facebook Page discovery failed temporarily. You can retry.";

    throw new MetaPageDiscoveryError(category, message, {
      status:
        category === "authorization_expired" ||
        category === "permission_required"
          ? 403
          : 503,
    });
  }

  return record;
}

/** Pure mapper for tests and Graph response shaping. */
export function mapDiscoveredMetaPageFromRecord(
  raw: Record<string, unknown>,
): DiscoveredMetaPage | null {
  const id = readString(raw, "id");
  const name = readString(raw, "name");

  if (!id || !name) {
    return null;
  }

  let profileImageUrl: string | null = null;
  const picture = raw.picture;

  if (
    typeof picture === "object" &&
    picture !== null &&
    !Array.isArray(picture)
  ) {
    const data = (picture as Record<string, unknown>).data;
    if (
      typeof data === "object" &&
      data !== null &&
      !Array.isArray(data)
    ) {
      profileImageUrl = readString(
        data as Record<string, unknown>,
        "url",
      );
    }
  }

  const tasksRaw = raw.tasks;
  const tasks = Array.isArray(tasksRaw)
    ? tasksRaw.filter(
        (item): item is string =>
          typeof item === "string" && item.length > 0,
      )
    : [];

  return {
    externalPageId: id,
    name,
    category: readString(raw, "category"),
    profileImageUrl,
    pageAccessToken: readString(raw, "access_token"),
    tasks,
  };
}

/** Fields used for listing Pages (tokens still requested when available). */
export const META_PAGE_LIST_FIELDS = [
  "id",
  "name",
  "picture{url}",
  "category",
  "access_token",
  "tasks",
] as const;

/** Fallback fields when a token-inclusive list returns empty. */
export const META_PAGE_LIST_FIELDS_MINIMAL = [
  "id",
  "name",
  "picture{url}",
  "category",
  "tasks",
] as const;

export type MetaPageFetchDiagnostics = {
  rawResultCount: number;
  pageCallCount: number;
  malformedRowCount: number;
  usedMinimalFieldsFallback: boolean;
  durationMs: number;
};

/**
 * Fetch all Facebook Pages the user can manage via /me/accounts.
 * Deduplicates by Page ID. Caps pagination for safety.
 */
export async function fetchManagedFacebookPages(options: {
  userAccessToken: string;
  fields?: readonly string[];
}): Promise<DiscoveredMetaPage[]> {
  const result = await fetchManagedFacebookPagesWithDiagnostics(options);
  return result.pages;
}

export async function fetchManagedFacebookPagesWithDiagnostics(options: {
  userAccessToken: string;
  fields?: readonly string[];
}): Promise<{
  pages: DiscoveredMetaPage[];
  diagnostics: MetaPageFetchDiagnostics;
}> {
  const started = Date.now();
  const fields = options.fields ?? META_PAGE_LIST_FIELDS;

  if (!options.userAccessToken.trim()) {
    throw new MetaPageDiscoveryError(
      "authorization_expired",
      "Facebook authorization is missing. Reconnect to continue.",
      { status: 403 },
    );
  }

  const collected = new Map<string, DiscoveredMetaPage>();
  let malformedRowCount = 0;
  let pageCallCount = 0;
  let nextUrl: URL | null = graphUrl("/me/accounts");
  nextUrl.searchParams.set("fields", fields.join(","));
  nextUrl.searchParams.set(
    "limit",
    String(META_PAGES_PAGE_SIZE),
  );
  nextUrl.searchParams.set(
    "access_token",
    options.userAccessToken,
  );

  for (let pageIndex = 0; pageIndex < META_PAGES_MAX_PAGES; pageIndex++) {
    if (!nextUrl) {
      break;
    }

    pageCallCount += 1;
    const record = await fetchMetaJson(
      nextUrl,
      "discover_pages",
    );
    const data = record.data;

    if (!Array.isArray(data)) {
      throw new MetaPageDiscoveryError(
        "malformed",
        "Facebook returned an incomplete Page list.",
        { status: 502 },
      );
    }

    for (const item of data) {
      if (
        typeof item !== "object" ||
        item === null ||
        Array.isArray(item)
      ) {
        malformedRowCount += 1;
        continue;
      }

      const mapped = mapDiscoveredMetaPageFromRecord(
        item as Record<string, unknown>,
      );

      if (!mapped) {
        malformedRowCount += 1;
        continue;
      }

      if (!collected.has(mapped.externalPageId)) {
        collected.set(mapped.externalPageId, mapped);
      }
    }

    const paging = record.paging;
    let next: string | null = null;

    if (
      typeof paging === "object" &&
      paging !== null &&
      !Array.isArray(paging)
    ) {
      next = readString(
        paging as Record<string, unknown>,
        "next",
      );
    }

    if (!next) {
      nextUrl = null;
      break;
    }

    try {
      const parsed = new URL(next);
      if (parsed.origin !== META_GRAPH_HOST) {
        throw new Error("host");
      }
      // Never log next URLs — they may contain access_token.
      nextUrl = parsed;
    } catch {
      throw new MetaPageDiscoveryError(
        "malformed",
        "Facebook returned an invalid pagination link.",
        { status: 502 },
      );
    }
  }

  return {
    pages: [...collected.values()],
    diagnostics: {
      rawResultCount: collected.size,
      pageCallCount,
      malformedRowCount,
      usedMinimalFieldsFallback: false,
      durationMs: Date.now() - started,
    },
  };
}

/**
 * Discover Pages for either Meta authorization mode.
 * If the primary field set returns zero rows, retry once with minimal
 * fields so granular "current Pages only" grants are not dropped by
 * token-field quirks — without incorrectly filtering selected Pages.
 */
export async function discoverManagedFacebookPagesForAuthorization(options: {
  userAccessToken: string;
}): Promise<{
  pages: DiscoveredMetaPage[];
  diagnostics: MetaPageFetchDiagnostics;
}> {
  const primary = await fetchManagedFacebookPagesWithDiagnostics({
    userAccessToken: options.userAccessToken,
    fields: META_PAGE_LIST_FIELDS,
  });

  if (primary.pages.length > 0) {
    return primary;
  }

  const fallback = await fetchManagedFacebookPagesWithDiagnostics({
    userAccessToken: options.userAccessToken,
    fields: META_PAGE_LIST_FIELDS_MINIMAL,
  });

  return {
    pages: fallback.pages,
    diagnostics: {
      rawResultCount: fallback.diagnostics.rawResultCount,
      pageCallCount:
        primary.diagnostics.pageCallCount +
        fallback.diagnostics.pageCallCount,
      malformedRowCount:
        primary.diagnostics.malformedRowCount +
        fallback.diagnostics.malformedRowCount,
      usedMinimalFieldsFallback: true,
      durationMs:
        primary.diagnostics.durationMs +
        fallback.diagnostics.durationMs,
    },
  };
}

/**
 * Fetch one managed Facebook Page by exact external Page ID from /me/accounts.
 * Stops pagination as soon as the target is found (selection path).
 */
export async function fetchManagedFacebookPageByExternalId(options: {
  userAccessToken: string;
  externalPageId: string;
  fields?: readonly string[];
}): Promise<DiscoveredMetaPage | null> {
  const externalPageId = options.externalPageId.trim();
  if (!options.userAccessToken.trim() || !externalPageId) {
    throw new MetaPageDiscoveryError(
      "authorization_expired",
      "Facebook authorization is missing. Reconnect to continue.",
      { status: 403 },
    );
  }

  const fields = options.fields ?? META_PAGE_LIST_FIELDS;
  let nextUrl: URL | null = graphUrl("/me/accounts");
  nextUrl.searchParams.set("fields", fields.join(","));
  nextUrl.searchParams.set("limit", String(META_PAGES_PAGE_SIZE));
  nextUrl.searchParams.set("access_token", options.userAccessToken);

  for (let pageIndex = 0; pageIndex < META_PAGES_MAX_PAGES; pageIndex++) {
    if (!nextUrl) {
      break;
    }

    const record = await fetchMetaJson(nextUrl, "revalidate_page_accounts");
    const data = record.data;

    if (!Array.isArray(data)) {
      throw new MetaPageDiscoveryError(
        "malformed",
        "Facebook returned an incomplete Page list.",
        { status: 502 },
      );
    }

    for (const item of data) {
      if (
        typeof item !== "object" ||
        item === null ||
        Array.isArray(item)
      ) {
        continue;
      }

      const mapped = mapDiscoveredMetaPageFromRecord(
        item as Record<string, unknown>,
      );

      if (mapped?.externalPageId === externalPageId) {
        return mapped;
      }
    }

    const paging = record.paging;
    let next: string | null = null;

    if (
      typeof paging === "object" &&
      paging !== null &&
      !Array.isArray(paging)
    ) {
      next = readString(paging as Record<string, unknown>, "next");
    }

    if (!next) {
      break;
    }

    try {
      const parsed = new URL(next);
      if (parsed.origin !== META_GRAPH_HOST) {
        throw new Error("host");
      }
      nextUrl = parsed;
    } catch {
      throw new MetaPageDiscoveryError(
        "malformed",
        "Facebook returned an invalid pagination link.",
        { status: 502 },
      );
    }
  }

  return null;
}

/**
 * Live selection revalidation by exact Facebook Page ID.
 *
 * Prefer `/me/accounts` exact-ID match with early pagination exit.
 * Direct `/{page-id}` with `access_token` is unreliable for user tokens and
 * often returns temporary failures — do not block selection on it.
 */
export async function revalidateManagedFacebookPage(options: {
  userAccessToken: string;
  externalPageId: string;
  /** Optional pre-fetched permissions; when omitted, fetched live. */
  grantedPermissions?: readonly string[];
}): Promise<
  DiscoveredMetaPage & {
    capability: FacebookPageCapabilityAssessment;
  }
> {
  const { fetchMetaGrantedPermissions } = await import(
    "@/lib/social/providers/meta-token"
  );

  if (!options.userAccessToken.trim()) {
    throw new MetaPageDiscoveryError(
      "authorization_expired",
      "Facebook authorization is missing. Reconnect to continue.",
      { status: 403 },
    );
  }

  const externalPageId = options.externalPageId.trim();

  if (!externalPageId) {
    throw new MetaPageDiscoveryError(
      "not_found",
      "The selected Facebook Page is no longer available through this authorization.",
      { status: 404 },
    );
  }

  // Canonical selection path: exact ID inside /me/accounts (token-inclusive).
  const match = await fetchManagedFacebookPageByExternalId({
    userAccessToken: options.userAccessToken,
    externalPageId,
    fields: META_PAGE_LIST_FIELDS,
  });

  if (!match) {
    throw new MetaPageDiscoveryError(
      "not_found",
      "The selected Facebook Page is no longer available through this authorization.",
      { status: 404 },
    );
  }

  if (!match.pageAccessToken) {
    throw new MetaPageDiscoveryError(
      "permission_required",
      "Facebook did not return a usable Page access token for the selected Page.",
      { status: 403 },
    );
  }

  const grantedPermissions =
    options.grantedPermissions ??
    (await fetchMetaGrantedPermissions({
      accessToken: options.userAccessToken,
    }));

  const capability = classifyFacebookPageCapability(
    match,
    grantedPermissions,
  );

  if (!capability.connectionEligible) {
    throw new MetaPageDiscoveryError(
      "permission_required",
      "This Facebook Page is not eligible to connect. A live Page access token and pages_read_engagement are required.",
      { status: 403 },
    );
  }

  return {
    ...match,
    capability,
  };
}
