import "server-only";

import {
  buildAtprotoLoopbackClientMetadata,
  JoseKey,
  Keyset,
  NodeOAuthClient,
  type OAuthClientMetadataInput,
} from "@atproto/oauth-client-node";

import { getApplicationOrigin } from "@/lib/config/app-origin";
import { requestBlueskyOAuthLock } from "@/lib/social/providers/bluesky-oauth-lock";
import {
  createBlueskySessionStore,
  createBlueskyStateStore,
} from "@/lib/social/providers/bluesky-oauth-store";

export const BLUESKY_CALLBACK_PATH =
  "/api/social/callback/bluesky";

export const BLUESKY_METADATA_PATH =
  "/oauth-client-metadata.json";

export const BLUESKY_JWKS_PATH =
  "/.well-known/jwks.json";

export const BLUESKY_SCOPE =
  "atproto transition:generic";

type BlueskyClientContext = {
  clientId: string;
  connectionId: string;
};

let signingKeyPromise: Promise<JoseKey> | null =
  null;

function applicationOrigin(): string {
  return getApplicationOrigin().replace(/\/$/, "");
}

function isLocalApplicationOrigin(
  origin: string,
): boolean {
  const url = new URL(origin);

  return (
    url.protocol === "http:" &&
    (url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1")
  );
}

function loopbackRedirectUri(
  origin: string,
): string {
  const url = new URL(origin);
  const port = url.port
    ? `:${url.port}`
    : "";

  return (
    `http://127.0.0.1${port}` +
    BLUESKY_CALLBACK_PATH
  );
}

function readPrivateJwk(): Record<string, unknown> {
  const raw =
    process.env.BLUESKY_OAUTH_PRIVATE_JWK?.trim();

  if (!raw) {
    throw new Error(
      "BLUESKY_OAUTH_PRIVATE_JWK is not configured.",
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "BLUESKY_OAUTH_PRIVATE_JWK must contain valid JSON.",
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      "BLUESKY_OAUTH_PRIVATE_JWK must contain a private JWK object.",
    );
  }

  const record =
    parsed as Record<string, unknown>;

  if (
    record.kty !== "EC" ||
    record.crv !== "P-256" ||
    record.alg !== "ES256" ||
    typeof record.d !== "string" ||
    !record.d
  ) {
    throw new Error(
      "BLUESKY_OAUTH_PRIVATE_JWK must be a private ES256 P-256 key.",
    );
  }

  return record;
}

async function getSigningKey(): Promise<JoseKey> {
  if (!signingKeyPromise) {
    signingKeyPromise =
      JoseKey.fromJWK(readPrivateJwk());
  }

  return signingKeyPromise;
}

async function getKeyset(): Promise<Keyset<JoseKey>> {
  return new Keyset([
    await getSigningKey(),
  ]);
}

export function getBlueskyClientMetadata():
  OAuthClientMetadataInput {
  const origin = applicationOrigin();

  if (isLocalApplicationOrigin(origin)) {
    return buildAtprotoLoopbackClientMetadata({
      scope: BLUESKY_SCOPE,
      redirect_uris: [
        loopbackRedirectUri(origin),
      ],
    });
  }

  return {
    client_id:
      `${origin}${BLUESKY_METADATA_PATH}`,
    client_name: "GROUPE TAKATAK",
    client_uri: origin,
    logo_uri: `${origin}/icon.png`,
    tos_uri: `${origin}/terms`,
    policy_uri: `${origin}/privacy`,
    redirect_uris: [
      `${origin}${BLUESKY_CALLBACK_PATH}`,
    ],
    scope: BLUESKY_SCOPE,
    grant_types: [
      "authorization_code",
      "refresh_token",
    ],
    response_types: ["code"],
    application_type: "web",
    token_endpoint_auth_method:
      "private_key_jwt",
    token_endpoint_auth_signing_alg:
      "ES256",
    dpop_bound_access_tokens: true,
    jwks_uri:
      `${origin}${BLUESKY_JWKS_PATH}`,
  };
}

export async function getBlueskyPublicJwks() {
  return (await getKeyset()).publicJwks;
}

const BLUESKY_AUTHORIZATION_SERVER_METADATA_URL =
  "https://bsky.social/.well-known/oauth-authorization-server";

const BLUESKY_METADATA_FETCH_ATTEMPTS = 3;
const BLUESKY_METADATA_FETCH_TIMEOUT_MS = 12_000;

function waitForRetry(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Retries only the idempotent Bluesky authorization-server metadata request.
 *
 * Token exchange, PAR, revocation and session requests are never retried here,
 * preventing duplicate OAuth mutations. The SDK continues validating the
 * metadata response and issuer.
 */
const blueskyOAuthFetch: typeof fetch = async (
  input,
  init,
) => {
  const requestUrl =
    input instanceof Request
      ? input.url
      : input instanceof URL
        ? input.toString()
        : String(input);

  const requestMethod =
    (
      init?.method ??
      (input instanceof Request
        ? input.method
        : "GET")
    ).toUpperCase();

  const retryMetadataRequest =
    requestMethod === "GET" &&
    requestUrl ===
      BLUESKY_AUTHORIZATION_SERVER_METADATA_URL;

  const attempts = retryMetadataRequest
    ? BLUESKY_METADATA_FETCH_ATTEMPTS
    : 1;

  let lastError: unknown = null;

  for (
    let attempt = 1;
    attempt <= attempts;
    attempt += 1
  ) {
    const timeoutSignal =
      retryMetadataRequest
        ? AbortSignal.timeout(
            BLUESKY_METADATA_FETCH_TIMEOUT_MS,
          )
        : null;

    const signal =
      timeoutSignal && init?.signal
        ? AbortSignal.any([
            init.signal,
            timeoutSignal,
          ])
        : timeoutSignal ??
          init?.signal ??
          undefined;

    try {
      const response =
        await globalThis.fetch(input, {
          ...init,
          signal,
          ...(retryMetadataRequest
            ? {
                cache: "no-store",
              }
            : {}),
        });

      if (
        !retryMetadataRequest ||
        response.ok ||
        response.status < 500 ||
        attempt === attempts
      ) {
        return response;
      }

      await response.body?.cancel();
      lastError = new Error(
        `Bluesky metadata returned HTTP ${response.status}.`,
      );
    } catch (error) {
      lastError = error;

      if (
        !retryMetadataRequest ||
        attempt === attempts
      ) {
        throw error;
      }
    }

    await waitForRetry(
      attempt === 1 ? 250 : 750,
    );
  }

  throw (
    lastError ??
    new Error(
      "Bluesky metadata could not be resolved.",
    )
  );
};

export async function createBlueskyOAuthClient(
  context: BlueskyClientContext,
): Promise<NodeOAuthClient> {
  const clientMetadata =
    getBlueskyClientMetadata();

  const keyset =
    clientMetadata.token_endpoint_auth_method ===
    "private_key_jwt"
      ? await getKeyset()
      : undefined;

  return new NodeOAuthClient({
    clientMetadata,
    fetch: blueskyOAuthFetch,
    requestLock: requestBlueskyOAuthLock,
    ...(keyset
      ? {
          keyset,
        }
      : {}),
    stateStore:
      createBlueskyStateStore(context),
    sessionStore:
      createBlueskySessionStore(context),
  });
}
