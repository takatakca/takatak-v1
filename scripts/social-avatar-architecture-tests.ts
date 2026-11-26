import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const instagramOAuth = read(
  "src/lib/social/providers/instagram-oauth.ts",
);
const instagramToken = read(
  "src/lib/social/providers/instagram-token.ts",
);
const threadsOAuth = read(
  "src/lib/social/providers/threads-oauth.ts",
);
const threadsToken = read(
  "src/lib/social/providers/threads-token.ts",
);
const providerRegistry = read(
  "src/lib/social/providers/registry.ts",
);
const connectionService = read(
  "src/lib/social/connections/social-connection-service.ts",
);

const instagramAdapter = read(
  "src/lib/social/avatars/providers/instagram-avatar.ts",
);
const threadsAdapter = read(
  "src/lib/social/avatars/providers/threads-avatar.ts",
);
const instagramService = read(
  "src/lib/social/connections/social-instagram-account-service.ts",
);
const directCallback = read(
  "src/lib/social/connections/direct-account-oauth-callback.ts",
);
const connectionsModal = read(
  "src/components/social/connections/manage-connections-modal.tsx",
);
const legacyThreadsRoute = read(
  "src/app/api/social/connections/[connectionId]/threads/route.ts",
);
const threadsAccountService = read(
  "src/lib/social/connections/social-threads-account-service.ts",
);
const pictureRoute = read(
  "src/app/api/social/media/picture/[accountId]/route.ts",
);
const connectionsRoute = read(
  "src/app/api/social/connections/route.ts",
);
const socialLayout = read(
  "src/app/dashboard/social/layout.tsx",
);

assert.match(
  instagramOAuth,
  /trimEnv\("INSTAGRAM_APP_ID"\)/,
  "Direct Instagram OAuth must require its own app ID.",
);

assert.doesNotMatch(
  instagramOAuth,
  /getMetaAppId/,
  "Direct Instagram OAuth must never reuse the Meta app ID.",
);

assert.doesNotMatch(
  instagramToken,
  /META_APP_SECRET/,
  "Direct Instagram token exchange must never reuse the Meta app secret.",
);

assert.match(
  threadsOAuth,
  /trimEnv\("THREADS_APP_ID"\)/,
  "Threads OAuth must require its own app ID.",
);

assert.doesNotMatch(
  threadsOAuth,
  /getMetaAppId/,
  "Threads OAuth must never reuse the Meta app ID.",
);

assert.doesNotMatch(
  threadsToken,
  /META_APP_SECRET/,
  "Threads token exchange must never reuse the Meta app secret.",
);

assert.match(
  providerRegistry,
  /"INSTAGRAM_APP_ID"[\s\S]*"INSTAGRAM_APP_SECRET"/,
  "Instagram readiness must use Instagram credentials.",
);

assert.match(
  providerRegistry,
  /"THREADS_APP_ID"[\s\S]*"THREADS_APP_SECRET"/,
  "Threads readiness must use Threads credentials.",
);

const materialPosition = connectionService.indexOf(
  "const material = prepareOAuthAttemptMaterial",
);
const transactionPosition = connectionService.indexOf(
  'runSocialDbTransaction(\n    "social-oauth-start"',
);

assert.ok(
  materialPosition !== -1 &&
    transactionPosition !== -1 &&
    materialPosition < transactionPosition,
  "OAuth configuration and URL construction must finish before database writes.",
);

assert.match(
  instagramAdapter,
  /context\.connectionProvider !== "instagram"/,
  "Instagram must require its own provider credential.",
);

assert.doesNotMatch(
  instagramAdapter,
  /threads_profile_picture_url/,
  "Instagram must never request a Threads image.",
);

assert.match(
  threadsAdapter,
  /context\.connectionProvider !== "threads"/,
  "Threads must require its own provider credential.",
);

assert.doesNotMatch(
  threadsAdapter,
  /profile_picture_url(?!")/,
  "Threads must never use Instagram's profile field.",
);

assert.doesNotMatch(
  instagramService,
  /disconnectThreadsAccountsForConnection/,
  "Disconnecting Instagram must not disconnect Threads.",
);

assert.match(
  directCallback,
  /synchronizeSocialAvatar/,
  "Direct OAuth must seed the durable avatar.",
);

// "Use Threads linked to Facebook" (owner decision 2026-11-26, option 2):
// allowed only as an entry point to the real Threads login. Threads data is
// never derived from the Meta connection; the linked path starts a stored
// Threads OAuth state, so the result is a `threads` connection with its own
// credential (see threadsAdapter above).
assert.doesNotMatch(
  legacyThreadsRoute,
  /connectLinkedThreadsAccount/,
  "The Threads POST route must not derive a Threads account from Instagram.",
);

assert.doesNotMatch(
  legacyThreadsRoute,
  /state:\s*connectionId/,
  "The Threads POST route must never use a raw connection id as OAuth state.",
);

assert.match(
  legacyThreadsRoute,
  /startLinkedThreadsAuthorization/,
  "Threads linked to Facebook must start a stored Threads authorization.",
);

assert.match(
  threadsAccountService,
  /export async function startLinkedThreadsAuthorization[\s\S]*?createSocialOAuthState\(\{[\s\S]*?provider: "threads"/,
  "The linked Threads path must create a Threads OAuth state.",
);

assert.match(
  connectionsModal,
  /async function connectThreads[\s\S]*?window\.location\.assign\(authorizationUrl\)/,
  "The UI must send Threads linked to Facebook to the Threads authorization page.",
);

assert.doesNotMatch(
  connectionsModal,
  /threads-from-ig|`threads-\$\{connection\.id\}`/,
  "The UI must not create a Threads account from a Meta connection.",
);

assert.match(
  pictureRoute,
  /getSocialAvatar/,
  "The picture endpoint must use durable avatar storage.",
);

for (const source of [connectionsRoute, socialLayout]) {
  assert.match(
    source,
    /account\.platform === ["']instagram["']/,
    "Instagram UI images must use the account-picture endpoint.",
  );
  assert.match(
    source,
    /account\.platform === ["']threads["']/,
    "Threads UI images must use the account-picture endpoint.",
  );
}

console.log("Social avatar architecture checks passed.");
