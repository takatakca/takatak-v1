// Supabase OAuth 2.1 consent helpers.
// authorization_id is GoTrue crypto.SecureAlphanumeric(32): lowercase
// base32 (a-z and 2-7), never a URL path. The decision route may send the
// browser only to https, a loopback http host, or a mimt:// app link.

import { NextRequest } from "next/server";

import {
  PRODUCTION_APP_ORIGIN,
  isProductionAppRuntime,
  resolvePublicUrl,
} from "@/lib/config/app-origin";
import {
  isTrustedRequestOrigin,
  normalizeOrigin,
} from "@/lib/auth/trusted-origin";
import { sanitizeNextPath } from "@/lib/security/safe-redirect";

const AUTHORIZATION_ID = /^[a-z2-7]{32}$/;
const MAX_REDIRECT_LENGTH = 2048;
const RAW_SCOPE = /^[a-z0-9_.:/-]{1,64}$/i;
const PHONE = /^\+[1-9]\d{6,14}$/;

export type ConsentLanguage = "fr" | "en";

export type ConsentSession = {
  id: string;
  email?: string | null;
  phone?: string | null;
};

export type AuthorizationPayload = {
  authorization_id?: string;
  redirect_uri?: string;
  redirect_url?: string;
  scope?: string;
  client?: { name?: string | null } | null;
  user?: { id?: string | null; email?: string | null } | null;
};

export type ConsentScreenModel = {
  kind: "consent";
  appName: string;
  returnAddress: string;
  returnAllowed: boolean;
  account: string;
  scopes: string[];
};

export type AuthorizationView =
  | ConsentScreenModel
  | { kind: "redirect"; target: string }
  | { kind: "invalid" }
  | { kind: "unsafe-redirect" };

const SCOPE_TEXT: Record<string, Record<ConsentLanguage, string>> = {
  openid: {
    fr: "Confirmer que vous êtes connecté à TAKATAK",
    en: "Confirm that you are signed in to TAKATAK",
  },
  email: {
    fr: "Voir votre adresse courriel",
    en: "See your email address",
  },
  profile: {
    fr: "Voir votre nom et votre profil",
    en: "See your name and profile",
  },
  phone: {
    fr: "Voir votre numéro de téléphone",
    en: "See your phone number",
  },
  offline_access: {
    fr: "Rester connecté après avoir fermé l’application",
    en: "Stay connected after you close the application",
  },
};

export function consentLanguage(value: unknown): ConsentLanguage {
  return value === "en" ? "en" : "fr";
}

/**
 * The consent form is a same-origin navigation. `/oauth` sends
 * `Referrer-Policy: no-referrer`, so Fetch serializes that POST's Origin
 * as the literal `null` and omits Referer. Accept that browser shape only
 * when the fetch metadata says the navigation is same-origin. A real
 * TAKATAK Origin is still accepted when Sec-Fetch-Site is absent or
 * `same-origin`. Every other origin, including `cross-site` and
 * `same-site`, is rejected. `isTrustedRequestOrigin` stays strict for
 * the other auth routes.
 */
export function isConsentPostAllowed(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (isTrustedRequestOrigin(request)) {
    return site === null || site === "same-origin";
  }

  if (!isMissingBlankOrNullOrigin(request.headers.get("origin"))) return false;
  if (site !== "same-origin") return false;

  const mode = request.headers.get("sec-fetch-mode");
  if (mode !== null && mode !== "navigate") return false;

  const dest = request.headers.get("sec-fetch-dest");
  if (dest !== null && dest !== "document") return false;

  const referer = request.headers.get("referer");
  if (referer === null || referer === "") return true;

  const refererOrigin = normalizeOrigin(referer);
  const expected = configuredAppOrigin(request);
  return refererOrigin !== null && expected !== null && refererOrigin === expected;
}

export function parseAuthorizationId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!AUTHORIZATION_ID.test(value)) return null;
  return value;
}

export function consentPagePath(
  authorizationId: string | null,
  language: ConsentLanguage,
): string {
  const params = new URLSearchParams();
  if (authorizationId) params.set("authorization_id", authorizationId);
  if (language === "en") params.set("lang", "en");
  const query = params.toString();
  return query ? `/oauth/consent?${query}` : "/oauth/consent";
}

/** Relative login URL that returns to this consent request after sign-in. */
export function consentLoginPath(
  authorizationId: string,
  language: ConsentLanguage,
): string {
  const next = consentPagePath(authorizationId, language);
  const safeNext = sanitizeNextPath(next, "/oauth/consent");
  return `/login?next=${encodeURIComponent(safeNext)}`;
}

/**
 * Accept the exact redirect string Supabase returned when it is https,
 * loopback http, or a mimt:// app link. Rejects credentials, control
 * characters, and every other scheme. Returns the original string so an
 * authorization code is not re-encoded.
 */
export function safeOAuthRedirectTarget(
  raw: string | null | undefined,
): string | null {
  if (typeof raw !== "string") return null;
  if (raw.length === 0 || raw.length > MAX_REDIRECT_LENGTH) return null;
  if (raw !== raw.trim()) return null;
  if (/[^\u0021-\u007e]/.test(raw) || raw.includes("\\")) return null;
  if (/%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(raw)) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;

  if (url.protocol === "https:") {
    return isAcceptableHttpsHost(url.hostname) ? raw : null;
  }
  if (url.protocol === "http:") {
    return isLoopbackHost(url.hostname) ? raw : null;
  }
  if (url.protocol === "mimt:") {
    return isMimtAppLink(url) ? raw : null;
  }
  return null;
}

export function consentScopeLines(
  scope: string,
  language: ConsentLanguage,
): string[] {
  const parts = scope.split(/\s+/).filter(Boolean);
  return parts.map((part) => {
    const known = SCOPE_TEXT[part];
    if (known) return known[language];
    if (RAW_SCOPE.test(part)) {
      return language === "fr" ? `Accès « ${part} »` : `Access “${part}”`;
    }
    return language === "fr" ? "Un accès non reconnu" : "An unrecognized access";
  });
}

export function consentAppName(
  name: string | null | undefined,
  language: ConsentLanguage,
): string {
  const cleaned = cleanLine(name);
  if (!cleaned) return language === "fr" ? "Une application" : "An application";
  return cleaned;
}

export function consentAccountLabel(
  input: {
    detailsEmail?: string | null;
    sessionEmail?: string | null;
    sessionPhone?: string | null;
  },
  language: ConsentLanguage,
): string {
  const detailsEmail = cleanLine(input.detailsEmail);
  const sessionEmail = cleanLine(input.sessionEmail);
  const phone = cleanLine(input.sessionPhone);
  if (detailsEmail.includes("@")) return detailsEmail;
  if (PHONE.test(phone)) return phone;
  if (sessionEmail.includes("@")) return sessionEmail;
  if (phone) return phone;
  return language === "fr"
    ? "Compte TAKATAK connecté"
    : "Signed-in TAKATAK account";
}

export function readAuthorizationResult(
  data: AuthorizationPayload | null | undefined,
  authorizationId: string,
  session: ConsentSession,
  language: ConsentLanguage,
): AuthorizationView {
  if (!data || typeof data !== "object") return { kind: "invalid" };

  if (typeof data.authorization_id === "string") {
    if (data.authorization_id !== authorizationId) return { kind: "invalid" };
    const userId = data.user?.id?.trim() ?? "";
    if (!userId || userId !== session.id) return { kind: "invalid" };
    const returnAddress = typeof data.redirect_uri === "string" ? data.redirect_uri : "";
    if (!returnAddress) return { kind: "invalid" };
    const visibleAddress = displayReturnAddress(returnAddress);
    if (!visibleAddress) return { kind: "unsafe-redirect" };
    return {
      kind: "consent",
      appName: consentAppName(data.client?.name, language),
      returnAddress: visibleAddress,
      returnAllowed: safeOAuthRedirectTarget(returnAddress) === returnAddress,
      account: consentAccountLabel(
        {
          detailsEmail: data.user?.email,
          sessionEmail: session.email,
          sessionPhone: session.phone,
        },
        language,
      ),
      scopes: consentScopeLines(
        typeof data.scope === "string" ? data.scope : "",
        language,
      ),
    };
  }

  if (typeof data.redirect_url === "string") {
    const target = safeOAuthRedirectTarget(data.redirect_url);
    return target ? { kind: "redirect", target } : { kind: "unsafe-redirect" };
  }

  return { kind: "invalid" };
}

export function escapeConsentHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function displayReturnAddress(raw: string): string | null {
  if (raw.length === 0 || raw.length > MAX_REDIRECT_LENGTH) return null;
  if (/[\u0000-\u001f\u007f]/.test(raw) || /\s/.test(raw)) return null;
  return raw;
}

function cleanLine(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 160);
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
}

function isAcceptableHttpsHost(hostname: string): boolean {
  if (!hostname || hostname.endsWith(".")) return false;
  const host = hostname.toLowerCase();
  if (host.startsWith("[")) return /^\[[0-9a-f:.]+\]$/.test(host);
  if (host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/.test(host);
}

function isMimtAppLink(url: URL): boolean {
  const host = url.hostname;
  if (host) {
    return /^[a-z0-9][a-z0-9._-]{0,120}$/i.test(host);
  }
  return url.pathname.length > 1;
}

/** Origin missing, blank, or the Fetch opaque-origin token `null`. */
function isMissingBlankOrNullOrigin(value: string | null): boolean {
  if (value === null) return true;
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "null";
}

/**
 * The same server-configured origin `isTrustedRequestOrigin` compares
 * against. A request Host cannot supply it.
 */
function configuredAppOrigin(request: NextRequest): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      const expected = resolvePublicUrl(configured);
      if (
        !["https:", "http:"].includes(expected.protocol) ||
        expected.username ||
        expected.password
      ) {
        return null;
      }
      return expected.origin;
    } catch {
      return null;
    }
  }

  if (isProductionAppRuntime()) return PRODUCTION_APP_ORIGIN;

  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}
