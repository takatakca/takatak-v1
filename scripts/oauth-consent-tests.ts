import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  consentAccountLabel,
  consentLoginPath,
  consentPagePath,
  consentScopeLines,
  escapeConsentHtml,
  parseAuthorizationId,
  readAuthorizationResult,
  safeOAuthRedirectTarget,
} from "../src/lib/auth/oauth-consent";
import { isHighRiskPath } from "../src/lib/security/authenticated-identity";
import { sanitizeNextPath } from "../src/lib/security/safe-redirect";

const ID = "abcdefghijklmnopqrstuvwxyz234567";
const SESSION = { id: "user-1", email: "ada@example.com", phone: "+15145550123" };

let failed = 0;

function assert(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` ${detail}` : ""}`);
}

function main() {
  console.log("[oauth-consent] authorization id");
  assert("accepts a 32-character base32 id", parseAuthorizationId(ID) === ID);
  assert("rejects a uuid", parseAuthorizationId("550e8400-e29b-41d4-a716-446655440000") === null);
  assert("rejects digits outside base32", parseAuthorizationId("abcdefghij0klmnopqrstuvwxyz23456") === null);
  assert("rejects a short id", parseAuthorizationId("abcdefghijklmnop") === null);
  assert("rejects a slash", parseAuthorizationId(`${ID.slice(0, 31)}/`) === null);
  assert("rejects an array", parseAuthorizationId([ID]) === null);
  assert("rejects surrounding space", parseAuthorizationId(` ${ID}`) === null);

  console.log("[oauth-consent] login return path");
  const frenchPage = consentPagePath(ID, "fr");
  const englishPage = consentPagePath(ID, "en");
  assert("French page keeps the authorization id", frenchPage === `/oauth/consent?authorization_id=${ID}`);
  assert("English page adds lang", englishPage === `/oauth/consent?authorization_id=${ID}&lang=en`);
  const login = consentLoginPath(ID, "en");
  const next = new URL(login, "https://takatak.ca").searchParams.get("next");
  assert("login next survives the existing sanitizer", sanitizeNextPath(next) === englishPage);
  assert("login next stays on this site", login.startsWith("/login?next=") && !login.includes("://"));

  console.log("[oauth-consent] return address");
  const allowed = [
    "https://app.example.com/callback?code=abc&state=xyz",
    "https://takatak.ca/oauth/done",
    "https://localhost:3000/callback",
    "https://127.0.0.1/callback",
    "http://localhost:3000/callback?code=abc",
    "http://127.0.0.1:54321/callback",
    "http://[::1]:3000/callback",
    "mimt://oauth/callback?code=abc&state=xyz",
    "MIMT://oauth/callback",
  ];
  for (const target of allowed) {
    assert(`allows ${target}`, safeOAuthRedirectTarget(target) === target);
  }
  const blocked = [
    "http://example.com/callback",
    "http://localhost.evil.com/callback",
    "http://127.0.0.1.evil.com/callback",
    "http://0.0.0.0/callback",
    "javascript:alert(1)",
    "data:text/html,hi",
    "file:///etc/passwd",
    "https://user:pass@example.com/callback",
    "https://takatak.ca@evil.com/callback",
    "https://example.com\\@evil.com",
    "//evil.com",
    "mimt://",
    "ftp://example.com",
    " https://example.com",
    "https://example.com\n",
    `https://example.com/${"a".repeat(2100)}`,
  ];
  for (const target of blocked) {
    assert(`blocks ${JSON.stringify(target)}`, safeOAuthRedirectTarget(target) === null);
  }

  console.log("[oauth-consent] screen model");
  const consent = readAuthorizationResult(
    {
      authorization_id: ID,
      redirect_uri: "mimt://oauth/callback",
      scope: "openid email profile phone offline_access custom:read",
      client: { name: "MIMT" },
      user: { id: SESSION.id, email: "" },
    },
    ID,
    { id: SESSION.id, phone: SESSION.phone },
    "fr",
  );
  assert("consent shows the app, phone account, and scopes", consent.kind === "consent" && consent.appName === "MIMT" && consent.account === SESSION.phone && consent.returnAllowed && consent.scopes[0]?.includes("connecté"));
  assert(
    "plain French scopes come first",
    consent.kind === "consent" &&
      consent.scopes[1] === "Voir votre adresse courriel" &&
      consent.scopes.includes("Accès « custom:read »"),
  );
  const english = consentScopeLines("openid email", "en");
  assert("English switch names the same access", english[0] === "Confirm that you are signed in to TAKATAK" && english[1] === "See your email address");
  assert(
    "email account is preferred when Supabase sends one",
    consentAccountLabel({ detailsEmail: "ada@example.com", sessionPhone: SESSION.phone }, "en") === "ada@example.com",
  );
  assert(
    "a different signed-in user cannot see the request",
    readAuthorizationResult(
      {
        authorization_id: ID,
        redirect_uri: "https://app.example.com/callback",
        client: { name: "MIMT" },
        user: { id: "someone-else", email: "ada@example.com" },
        scope: "openid",
      },
      ID,
      SESSION,
      "fr",
    ).kind === "invalid",
  );
  assert(
    "an already approved request redirects only when the address is safe",
    readAuthorizationResult({ redirect_url: "https://app.example.com/callback?code=abc" }, ID, SESSION, "fr").kind === "redirect",
  );
  assert(
    "an already approved javascript address is not followed",
    readAuthorizationResult({ redirect_url: "javascript:alert(1)" }, ID, SESSION, "fr").kind === "unsafe-redirect",
  );
  assert(
    "a public http return address hides the buttons",
    readAuthorizationResult(
      {
        authorization_id: ID,
        redirect_uri: "http://example.com/callback",
        client: { name: "MIMT" },
        user: { id: SESSION.id, email: SESSION.email },
        scope: "openid",
      },
      ID,
      SESSION,
      "fr",
    ).kind === "consent" &&
      (readAuthorizationResult(
        {
          authorization_id: ID,
          redirect_uri: "http://example.com/callback",
          client: { name: "MIMT" },
          user: { id: SESSION.id, email: SESSION.email },
          scope: "openid",
        },
        ID,
        SESSION,
        "fr",
      ) as { returnAllowed?: boolean }).returnAllowed === false,
  );
  assert("html notice escapes markup", escapeConsentHtml(`<a href="x">`) === "&lt;a href=&quot;x&quot;&gt;");

  console.log("[oauth-consent] page and decision route");
  const page = readFileSync(resolve(process.cwd(), "src/app/oauth/consent/page.tsx"), "utf8");
  const route = readFileSync(resolve(process.cwd(), "src/app/api/oauth/consent/route.ts"), "utf8");
  const robots = readFileSync(resolve(process.cwd(), "src/app/robots.ts"), "utf8");
  const headers = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");
  assert("page asks Supabase for the authorization", page.includes("getAuthorizationDetails(authorizationId)"));
  assert("signed-out visitors return through /login?next=", page.includes("consentLoginPath(authorizationId, language)"));
  assert("French is the default copy", page.includes("Autoriser") && page.includes("Refuser") && page.includes('consentLanguage(singleQuery(params.lang))'));
  assert("choice posts to the same-origin decision route", page.includes('action="/api/oauth/consent"') && page.includes('method="post"'));
  assert("page stays out of search results", page.includes("index: false") && page.includes("follow: false"));
  assert(
    "decision route approves and denies without a browser redirect",
    route.includes("approveAuthorization(authorizationId, { skipBrowserRedirect: true })") &&
      route.includes("denyAuthorization(authorizationId, { skipBrowserRedirect: true })") &&
      route.includes("safeOAuthRedirectTarget"),
  );
  assert("decision route checks the TAKATAK origin", route.includes("isTrustedRequestOrigin"));
  assert("decision redirect is See Other", route.includes("status: 303"));
  assert("robots.txt blocks the consent path", robots.includes('"/oauth"') && robots.includes('"/oauth/"'));
  assert("consent responses send a noindex header", headers.includes('source: "/oauth/:path*"') && headers.includes("noindex, nofollow, noarchive"));
  assert("consent is a high-risk session check", isHighRiskPath("/oauth/consent") && isHighRiskPath("/api/oauth/consent"));
  assert("ordinary pages stay low risk", !isHighRiskPath("/login") && !isHighRiskPath("/"));

  if (failed > 0) {
    console.error(`[oauth-consent] ${failed} failed`);
    process.exit(1);
  }
  console.log("[oauth-consent] all checks passed");
}

main();
