import "server-only";

import { ServiceError } from "@/lib/services/service-error";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";

const ACCOUNT_API =
  "https://mybusinessaccountmanagement.googleapis.com/v1";

const BUSINESS_API =
  "https://mybusinessbusinessinformation.googleapis.com/v1";

const REQUEST_TIMEOUT_MS = 15_000;

export type GoogleBusinessLocationRecord = {
  externalAccountId: string;
  displayName: string;
  handle: string | null;
  category: string | null;
  profileUrl: string | null;
  metadata: Record<
    string,
    string | string[] | null
  >;
};

function text(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];

  return typeof value === "string" &&
    value.trim()
    ? value.trim()
    : null;
}

function object(
  value: unknown,
): Record<string, unknown> | null {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function getJson(
  url: URL,
  accessToken: string,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const contentType =
      response.headers.get("content-type") ?? "";

    const body = contentType.includes(
      "application/json",
    )
      ? await response
          .json()
          .catch(() => null)
      : null;

    if (!response.ok || !object(body)) {
      logSocialOAuthEvent(
        "google-business-profile",
        {
          stage: "discovery",
          outcome: "failed",
          provider: "google",
        },
      );

      throw new ServiceError(
        response.status === 403
          ? "forbidden"
          : "unavailable",
        response.status === 403
          ? "Google Business Profile access was not granted for this account."
          : "Google Business Profile locations could not be loaded.",
        {
          status:
            response.status === 403
              ? 403
              : 502,
        },
      );
    }

    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }

    throw new ServiceError(
      "unavailable",
      error instanceof Error &&
        error.name === "AbortError"
        ? "Google Business Profile timed out. You can retry."
        : "Google Business Profile locations could not be loaded.",
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function listGoogleBusinessLocations(
  options: {
    accessToken: string;
  },
): Promise<GoogleBusinessLocationRecord[]> {
  const accounts: Record<string, unknown>[] =
    [];

  let accountPageToken: string | null = null;

  do {
    const url = new URL(
      `${ACCOUNT_API}/accounts`,
    );

    url.searchParams.set("pageSize", "20");

    if (accountPageToken) {
      url.searchParams.set(
        "pageToken",
        accountPageToken,
      );
    }

    const body = await getJson(
      url,
      options.accessToken,
    );

    if (Array.isArray(body.accounts)) {
      accounts.push(
        ...body.accounts
          .map(object)
          .filter(
            (
              value,
            ): value is Record<
              string,
              unknown
            > => Boolean(value),
          ),
      );
    }

    accountPageToken = text(
      body,
      "nextPageToken",
    );
  } while (accountPageToken);

  const byName = new Map<
    string,
    GoogleBusinessLocationRecord
  >();

  for (const account of accounts) {
    const accountName = text(
      account,
      "name",
    );

    if (
      !accountName ||
      !/^accounts\/[^/]+$/.test(accountName)
    ) {
      continue;
    }

    let locationPageToken: string | null =
      null;

    do {
      const url = new URL(
        `${BUSINESS_API}/${accountName}/locations`,
      );

      url.searchParams.set(
        "readMask",
        [
          "name",
          "title",
          "storeCode",
          "websiteUri",
          "phoneNumbers",
          "categories",
          "storefrontAddress",
          "metadata",
        ].join(","),
      );

      url.searchParams.set(
        "pageSize",
        "100",
      );

      if (locationPageToken) {
        url.searchParams.set(
          "pageToken",
          locationPageToken,
        );
      }

      const body = await getJson(
        url,
        options.accessToken,
      );

      if (Array.isArray(body.locations)) {
        for (const item of body.locations) {
          const location = object(item);

          if (!location) {
            continue;
          }

          const name = text(
            location,
            "name",
          );

          const title = text(
            location,
            "title",
          );

          if (
            !name ||
            !/^locations\/[^/]+$/.test(
              name,
            ) ||
            !title
          ) {
            continue;
          }

          const categories = object(
            location.categories,
          );

          const primaryCategory = object(
            categories?.primaryCategory,
          );

          const address = object(
            location.storefrontAddress,
          );

          const addressLines = Array.isArray(
            address?.addressLines,
          )
            ? address.addressLines.filter(
                (
                  value,
                ): value is string =>
                  typeof value === "string",
              )
            : [];

          byName.set(name, {
            externalAccountId: name,
            displayName: title,
            handle: text(
              location,
              "storeCode",
            ),
            category: text(
              primaryCategory ?? {},
              "displayName",
            ),
            profileUrl: text(
              location,
              "websiteUri",
            ),
            metadata: {
              source:
                "google_business_profile",
              googleAccountName:
                accountName,
              googleAccountLabel: text(
                account,
                "accountName",
              ),
              addressLines,
              locality: text(
                address ?? {},
                "locality",
              ),
              administrativeArea: text(
                address ?? {},
                "administrativeArea",
              ),
              postalCode: text(
                address ?? {},
                "postalCode",
              ),
              countryCode: text(
                address ?? {},
                "regionCode",
              ),
            },
          });
        }
      }

      locationPageToken = text(
        body,
        "nextPageToken",
      );
    } while (locationPageToken);
  }

  return [...byName.values()];
}
