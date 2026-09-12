/**
 * Instagram professional account connection tests.
 * Synthetic Graph payloads only. Never prints tokens, codes, or IDs.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  canAttachLinkedInstagram,
  canAttachLinkedThreads,
} from "../src/lib/social/connections/social-connection-lifecycle-policy";
import {
  pickSelectedInstagramAccount,
  pickSelectedInstagramAccountStrict,
} from "../src/lib/social/connections/social-canonical-identity";
import { mapLinkedInstagramFromPageRecord } from "../src/lib/social/providers/meta-instagram";
import {
  META_OAUTH_INSTAGRAM_SCOPES,
  META_OAUTH_PAGE_SCOPES,
  META_OAUTH_START_SCOPES,
} from "../src/lib/social/providers/meta-oauth";
import {
  assertRequiredMetaPageScopes,
  hasRequiredMetaInstagramScopes,
} from "../src/lib/social/providers/meta-token";

type Status = "PASS" | "FAIL";
type Result = { name: string; status: Status; evidence: string };

const results: Result[] = [];

function check(name: string, run: () => string) {
  try {
    results.push({ name, status: "PASS", evidence: run() });
  } catch (error) {
    results.push({
      name,
      status: "FAIL",
      evidence: error instanceof Error ? error.message : "unknown",
    });
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readSource(relative: string): string {
  return readFileSync(resolve(process.cwd(), relative), "utf8");
}

check("Facebook OAuth start excludes Instagram identity scopes", () => {
  const facebookScopes: readonly string[] = META_OAUTH_START_SCOPES;

  assert(
    !facebookScopes.includes("instagram_basic"),
    "instagram_basic leaked into Facebook Login",
  );

  assert(
    !facebookScopes.includes("instagram_manage_insights"),
    "instagram_manage_insights leaked into Facebook Login",
  );

  assert(
    META_OAUTH_INSTAGRAM_SCOPES[0] === "instagram_basic",
    "linked Instagram scopes are unavailable",
  );

  return "Facebook Page scopes only; linked Instagram scopes remain separate";
});

check("Facebook Page setup does not require Instagram scopes", () => {
  assertRequiredMetaPageScopes([...META_OAUTH_PAGE_SCOPES]);
  let blocked = false;
  try {
    assertRequiredMetaPageScopes(["public_profile"]);
  } catch {
    blocked = true;
  }
  assert(blocked, "page scopes still required");
  assert(
    hasRequiredMetaInstagramScopes(["pages_show_list"]) === false,
    "ig missing",
  );
  assert(
    hasRequiredMetaInstagramScopes(["instagram_basic"]) === true,
    "ig present",
  );
  return "Page scopes independent of Instagram";
});

check("Graph mapper reads linked Instagram professional account", () => {
  const mapped = mapLinkedInstagramFromPageRecord({
    id: "page-should-not-leak",
    instagram_business_account: {
      id: "ig-should-not-print",
      username: "bakery.mtl",
      name: "Montreal Bakery",
      profile_picture_url: "https://scontent.cdninstagram.com/pic.jpg",
    },
  });
  assert(mapped?.handle === "bakery.mtl", "handle");
  assert(mapped?.displayName === "Montreal Bakery", "name");
  assert(mapped?.profileImageUrl?.includes("cdninstagram.com"), "picture");
  assert(!mapped?.handle.includes("page-"), "no page id as handle");
  const missing = mapLinkedInstagramFromPageRecord({
    id: "page",
    instagram_business_account: null,
  });
  assert(missing === null, "empty");
  return "username/name mapped; empty Page has no Instagram";
});

check("Selected Instagram picker is strict", () => {
  const ready = pickSelectedInstagramAccountStrict([
    {
      id: "a",
      platform: "instagram",
      status: "connected",
      accessStatus: "selected",
      displayName: "Bakery",
    },
  ]);
  assert(ready.kind === "ready", "ready");
  assert(
    pickSelectedInstagramAccount([
      {
        id: "a",
        platform: "instagram",
        status: "connected",
        accessStatus: "selected",
        displayName: "Bakery",
      },
    ])?.displayName === "Bakery",
    "label",
  );
  const ambiguous = pickSelectedInstagramAccountStrict([
    {
      id: "a",
      platform: "instagram",
      status: "connected",
      accessStatus: "selected",
    },
    {
      id: "b",
      platform: "instagram",
      status: "connected",
      accessStatus: "selected",
    },
  ]);
  assert(ambiguous.kind === "ambiguous", "ambiguous");
  return "strict selected Instagram identity";
});

check("Attach policy requires a selected Facebook Page", () => {
  assert(
    canAttachLinkedInstagram({
      facebookPageSelected: true,
      instagramAlreadyConnected: false,
      connectionStatus: "connected",
    }).allowed,
    "allowed",
  );
  assert(
    !canAttachLinkedInstagram({
      facebookPageSelected: false,
      instagramAlreadyConnected: false,
      connectionStatus: "connected",
    }).allowed,
    "page required",
  );
  return "Facebook Page is a prerequisite";
});

check("Threads Meta attach requires Facebook Page and Instagram", () => {
  assert(
    canAttachLinkedThreads({
      facebookPageSelected: true,
      metaInstagramConnected: true,
      threadsAlreadyConnected: false,
      connectionStatus: "connected",
    }).allowed,
    "allowed",
  );
  assert(
    !canAttachLinkedThreads({
      facebookPageSelected: true,
      metaInstagramConnected: false,
      threadsAlreadyConnected: false,
      connectionStatus: "connected",
    }).allowed,
    "instagram required",
  );
  return "Threads follows Instagram on Meta";
});

check("Instagram and Threads start independent OAuth from the modal", () => {
  const modal = readSource(
    "src/components/social/connections/manage-connections-modal.tsx",
  );
  assert(modal.includes('provider: "instagram"'), "ig provider card");
  assert(modal.includes('provider: "threads"'), "threads provider card");
  assert(modal.includes("connectInstagram"), "facebook-linked instagram");
  assert(modal.includes("connectThreads"), "facebook-linked threads");
  assert(
    modal.includes("Use Instagram linked to Facebook"),
    "facebook primary when page is ready",
  );
  assert(
    modal.includes("Or sign in with Instagram independently"),
    "independent option",
  );
  assert(
    modal.includes("Use Threads linked to Facebook"),
    "threads facebook primary",
  );
  assert(
    modal.includes("Or sign in with Threads independently"),
    "threads independent option",
  );
  assert(modal.includes("/instagram"), "instagram API");
  assert(
    !modal.includes("Instagram connects through Facebook Meta"),
    "no meta-only hover",
  );
  return "independent Instagram and Threads cards";
});

check("Independent Instagram Login and Threads callbacks exist", () => {
  const files = [
    "src/lib/social/providers/instagram-oauth.ts",
    "src/lib/social/providers/instagram-token.ts",
    "src/lib/social/providers/threads-oauth.ts",
    "src/lib/social/providers/threads-token.ts",
    "src/app/api/social/callback/instagram/route.ts",
    "src/app/api/social/callback/instagram/handoff/route.ts",
    "src/app/api/social/callback/threads/route.ts",
    "src/app/api/social/callback/threads/handoff/route.ts",
    "src/app/api/social/connections/[connectionId]/threads/route.ts",
    "src/lib/social/connections/social-threads-account-service.ts",
    "prisma/migrations/20260826010000_instagram_threads_providers/migration.sql",
  ];
  for (const file of files) {
    assert(existsSync(resolve(process.cwd(), file)), file);
  }
  const oauth = readSource("src/lib/social/providers/instagram-oauth.ts");
  assert(oauth.includes("instagram.com"), "instagram host");
  assert(oauth.includes("instagram_business_basic"), "ig scopes");
  const threads = readSource("src/lib/social/providers/threads-oauth.ts");
  assert(threads.includes("threads.net"), "threads host");
  assert(threads.includes("threads_basic"), "threads scopes");
  return "direct login routes";
});

check("Instagram page offers Facebook-linked and independent login", () => {
  const page = readSource(
    "src/components/social/platforms/instagram-connect-page.tsx",
  );
  assert(page.includes("connectViaFacebook"), "facebook attach");
  assert(page.includes("/${network}"), "meta attach API");
  assert(page.includes('provider: network'), "independent start");
  assert(
    page.includes("Use ${label} linked to Facebook") ||
      page.includes("Use ${label} linked to Facebook"),
    "facebook CTA",
  );
  assert(page.includes("independently"), "independent CTA");
  const resolve = readSource(
    "src/lib/social/connections/instagram-dashboard-resolve.ts",
  );
  const metaFirst =
    resolve.indexOf('source: "facebook_page"') <
    resolve.indexOf('source: "instagram_login"');
  assert(metaFirst, "meta linked is preferred");
  assert(resolve.includes("instagram_login"), "login source");
  assert(resolve.includes("facebook_page"), "facebook source");
  return "both Instagram routes";
});

check("Uniqueness migration exists", () => {
  const path =
    "prisma/migrations/20260826000000_instagram_professional_uniqueness/migration.sql";
  assert(existsSync(resolve(process.cwd(), path)), "file");
  const sql = readSource(path);
  assert(sql.includes("sa_one_connected_instagram_account_per_client_key"), "client");
  assert(sql.includes("sa_one_connected_instagram_per_connection_key"), "connection");
  return "partial unique indexes";
});

const failed = results.filter((row) => row.status === "FAIL");

for (const row of results) {
  console.log(`${row.status}  ${row.name} — ${row.evidence}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} Instagram connection check(s) failed.`);
  process.exit(1);
}

console.log(`\n${results.length} Instagram connection checks passed.`);
